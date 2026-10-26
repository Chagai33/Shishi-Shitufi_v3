const { onCall, HttpsError } = require("firebase-functions/v2/https");
// Force Deploy Update: 2026-02-01 12:15
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");
// firebase-admin 14 removed the single-namespace export. Same two services,
// reached the way the library now offers them. See the note in index.js.
const { getApps, initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

// What this function decides, in a file with no requires of its own so that the
// decisions can be run by a test. The ordering of the three steps below, and
// the reason for it, is written over runImport there.
const {
  CALLS_PER_HOUR,
  CALLS_PER_DAY,
  ImportRefusal,
  rateLimit,
  runImport,
} = require("./smartImportPolicy");

const googleAiKey = defineSecret("GOOGLE_AI_KEY");

// Where the counters are kept.
//
// Nothing under this path is defined in database.rules.json, so every client is
// denied it by default, and that matters: it says which identity used a paid
// feature and when. The function reaches it through the Admin SDK, which passes
// the rules entirely, which is why no rule change goes with this one. The same
// arrangement is already in use for deletionFailures in index.js.
const USAGE_PATH = "aiUsage";

// index.js initialises the app before it requires this file, and in production
// that is always the order. The guard is for anything that loads this module on
// its own. Resolved on the way in rather than at module scope, because the CLI
// loads this file during discovery and nothing there needs a database.
function usageRef(uid) {
  if (!getApps().length) initializeApp();
  return getDatabase().ref(`${USAGE_PATH}/${uid}`);
}

/**
 * Counts this call against the caller, or refuses it.
 *
 * A transaction and not a read followed by a write, because the whole point is
 * the caller who fires many at once: two calls that both read the same free slot
 * would both take it.
 *
 * Called once the input has been found valid and before the model is reached,
 * which is the one thing about it that is a decision rather than a mechanism.
 * That decision, and the line it must not cross, is written over runImport in
 * smartImportPolicy.js.
 *
 * And if the counter cannot be reached at all the call is refused rather than
 * let through. Letting it through would mean the one thing this whole record
 * exists to stop, unlimited paid calls, resumes the moment the database has a
 * bad minute. Refusing costs an organiser a feature they can do by hand, and the
 * screen already tells them so.
 */
async function chargeOneCall(uid) {
  const now = Date.now();
  let outcome;

  try {
    outcome = await usageRef(uid).transaction((current) => {
      const decision = rateLimit(current, now);
      // Returning nothing aborts the transaction, so a refused call writes
      // nothing at all and cannot move the counter it just bounced off.
      return decision.allowed ? decision.next : undefined;
    });
  } catch (error) {
    console.error("AI usage counter unavailable:", error);
    throw new HttpsError(
      "unavailable",
      "Usage limits could not be checked, so the request was not sent.",
      { originalError: "RATE_LIMIT_UNAVAILABLE" }
    );
  }

  if (outcome.committed) return;

  const refusal = rateLimit(outcome.snapshot.val(), now);
  console.warn(`AI rate limit refused a call from ${uid}.`);
  throw new HttpsError(
    "resource-exhausted",
    `Rate limit reached. Max ${CALLS_PER_HOUR} calls per hour and ${CALLS_PER_DAY} per day.`,
    { originalError: "RATE_LIMITED", retryAfterMinutes: refusal.retryAfterMinutes || 1 }
  );
}

// Google retires Gemini models periodically, and a retired model fails at runtime
// with a 404 rather than at deploy time. Keeping the name overridable means the next
// retirement can be handled by setting GEMINI_MODEL instead of editing this file.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

/**
 * The paid call itself, and nothing else.
 *
 * Everything in here costs money or depends on something that does, which is
 * why it is the one piece the policy file does not hold: it is handed in as a
 * callback, so a test can exercise the decisions around it without reaching the
 * model. It throws whatever the library throws, and classifyModelError decides
 * what that was.
 */
async function callModel(apiKey, data) {
  const { text, image, mimeType, allowedCategories } = data;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  // Golden Prompt
  const systemPrompt = `You are a Hebrew event item parser and classifier.
Your inputs are: 1. Text/Image list. 2. Allowed Categories (JSON Array of {id, name}).
Task: Extract items [{ name: string, quantity: number, category?: string }] and classify strictly into Allowed Categories.
Rules:
- Handle slang (e.g., '2 חלב', 'חלב פעמיים' -> quantity: 2).
- Clean names (remove 'bottles of', 'packages of', etc.).
- Default quantity = 1.
- Category Logic:
  - You will be provided with a JSON list of allowed categories.
  - You MUST try to match each item to the most appropriate category 'id' from that list based on the 'name'.
  - Return the 'id' exactly as it appears in the list, character for character. Ids are opaque and a real one can look like "custom-1755701234567". Never return the category name instead of its id, and never invent an id that is not in the list.
  - If "meat" (בשר) is in the list and item is "kebab", use "meat".
  - If you genuinely cannot place an item, omit the 'category' field for that item entirely. Do not guess and do not fall back to a catch-all such as "other" or "general". A missing field tells the client you had no answer, and the client then keeps the category the item already has, which is what the organiser sorted by hand.
- Output ONLY valid JSON array of objects.`;

  const parts = [systemPrompt];
  if (allowedCategories && Array.isArray(allowedCategories)) {
    parts.push(`Allowed Categories: ${JSON.stringify(allowedCategories)}`);
  }
  if (text) parts.push(`Input Text: "${text}"`);
  if (image) {
    parts.push({
      inlineData: {
        data: image,
        mimeType: mimeType || "image/jpeg",
      },
    });
  }

  const result = await model.generateContent(parts);
  const response = await result.response;
  const jsonString = response.text();

  const items = JSON.parse(jsonString);

  if (!Array.isArray(items)) {
    throw new Error("AI returned invalid structure (not an array).");
  }

  return { items };
}

exports.parseShoppingList = onCall(
  {
    secrets: [googleAiKey],
    region: "us-central1",
    maxInstances: 10,
    cors: true,
  },
  async (request) => {
    // 1. Resolve API Key (Secret vs Local Fallback)
    const apiKey = googleAiKey.value() || process.env.GOOGLE_AI_KEY;

    if (!apiKey) {
      console.error("GOOGLE_AI_KEY is missing.");
      throw new HttpsError("internal", "Server misconfiguration: Missing AI Key.");
    }

    // 2. Auth Check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    // 3. The input, then the caller's allowance, then the model, in that order
    //    and for the reason written over runImport in smartImportPolicy.js.
    try {
      return await runImport({
        data: request.data,
        modelName: GEMINI_MODEL,
        charge: () => chargeOneCall(request.auth.uid),
        callModel: () => callModel(apiKey, request.data),
      });
    } catch (error) {
      // A refusal this function decided on becomes the error the screens read.
      // Anything else is already an HttpsError thrown by chargeOneCall, and is
      // passed through exactly as it was.
      if (error instanceof ImportRefusal) {
        throw new HttpsError(error.code, error.message, error.details);
      }
      throw error;
    }
  }
);
