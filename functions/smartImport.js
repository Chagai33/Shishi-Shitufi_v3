const { onCall, HttpsError } = require("firebase-functions/v2/https");
// Force Deploy Update: 2026-02-01 12:15
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require("firebase-admin");

const googleAiKey = defineSecret("GOOGLE_AI_KEY");

// How many calls one signed-in identity may make, in two windows at once.
//
// Two windows rather than one because they stop two different things: the hour
// stops a loop, and the day stops slow grinding. Both numbers are deliberately
// generous, since a real organiser uses the smart import once or twice for an
// event. The ceiling is here to stop abuse, not use.
//
// They live in this file and not in src/constants/limits.json, where every
// other ceiling in the product lives, because a deployed function carries only
// what is inside functions/ and cannot read that file. Nothing outside this
// function needs these two numbers, so there is no second copy to drift from.
// See DOCS/PLANING/53-ai-limits-and-costs.md.
const CALLS_PER_HOUR = 5;
const CALLS_PER_DAY = 20;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

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
  if (!admin.apps.length) admin.initializeApp();
  return admin.database().ref(`${USAGE_PATH}/${uid}`);
}

/**
 * What one window looks like for a call arriving now: the window already open,
 * or a fresh one starting at this call.
 *
 * The window is a fixed one that starts at its first call, so a window that has
 * filled up is not pushed further out by the calls it refuses.
 */
function windowNow(start, count, span, now) {
  const open = typeof start === "number" && now - start < span;
  return open
    ? { start, count: typeof count === "number" ? count : 0, span }
    : { start: now, count: 0, span };
}

/**
 * Whether this call is allowed, and what the counter becomes if it is.
 *
 * Pure on purpose. A transaction handler may run more than once, and the same
 * answer has to be reachable again afterwards in order to tell the caller when
 * they are free, so nothing here may depend on having been called before.
 */
function rateLimit(current, now) {
  const state = current || {};
  const hour = windowNow(state.hourStart, state.hourCount, HOUR_MS, now);
  const day = windowNow(state.dayStart, state.dayCount, DAY_MS, now);

  const full =
    hour.count >= CALLS_PER_HOUR ? hour : day.count >= CALLS_PER_DAY ? day : null;

  if (full) {
    const msLeft = full.start + full.span - now;
    return { allowed: false, retryAfterMinutes: Math.max(1, Math.ceil(msLeft / 60000)) };
  }

  return {
    allowed: true,
    next: {
      hourStart: hour.start,
      hourCount: hour.count + 1,
      dayStart: day.start,
      dayCount: day.count + 1,
    },
  };
}

/**
 * Counts this call against the caller, or refuses it.
 *
 * A transaction and not a read followed by a write, because the whole point is
 * the caller who fires many at once: two calls that both read the same free slot
 * would both take it.
 *
 * The call is counted on the attempt and not on the answer. A refund on failure
 * would be its own way through, since a caller who can make the model fail could
 * then call without limit.
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

    // 3. Rate limit, per identity.
    //
    // Before the arguments are looked at and before anything is sent anywhere,
    // so that there is no shape of request that reaches the model without being
    // counted first. A caller sending nothing but rubbish still spends their own
    // allowance, which is the point: an empty request costs an invocation, and a
    // loop of them is exactly what this stops.
    //
    // Outside the try below on purpose. That catch reads the message of whatever
    // it is given and would turn this refusal into an internal error.
    await chargeOneCall(request.auth.uid);

    const { text, image, mimeType, allowedCategories } = request.data;

    // Validate: Must have either text or image
    if ((!text || typeof text !== "string" || text.trim().length === 0) && (!image || typeof image !== "string")) {
      throw new HttpsError("invalid-argument", "Please provide a shopping list text or image.");
    }

    // Security/Safety Checks
    //
    // Marked, because the screens have to tell this apart from the other things
    // invalid-argument means. It is the one an organiser can walk into by having
    // a large event rather than by sending something wrong, and being told the
    // text is invalid does not help them.
    if (text && text.length > 2000) {
      throw new HttpsError("invalid-argument", "Text too long. Max 2000 characters.", {
        originalError: "TEXT_TOO_LONG",
      });
    }

    // Base64 string length check: 5MB image ≈ 6.7MB base64. 
    // Setting limit to 7,000,000 chars to be safe.
    if (image && image.length > 7000000) {
      throw new HttpsError("invalid-argument", "Image too large. Max 5MB.");
    }

    try {
      // 3. Initialize Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      // 4. Golden Prompt
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

      // 5. Generate Content
      const result = await model.generateContent(parts);
      const response = await result.response;
      const jsonString = response.text();

      // 6. Parse & Validate
      const items = JSON.parse(jsonString);

      if (!Array.isArray(items)) {
        throw new Error("AI returned invalid structure (not an array).");
      }

      return { items };
    } catch (error) {
      console.error("Smart Import Error Details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));

      // 1. Quota / Billing Errors
      if (error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("exhausted")) {
        throw new HttpsError("resource-exhausted", "AI quota exceeded. Please try again later.", { originalError: "QUOTA_EXCEEDED" });
      }

      // 2. Safety / Policy Errors
      if (error.response?.promptFeedback?.blockReason || error.message?.includes("blocked")) {
        throw new HttpsError("failed-precondition", "The input was blocked by AI safety filters.", { originalError: "SAFETY_BLOCK" });
      }

      // 3. Retired / unknown model - surfaces as a 404 from the Gemini API
      if (error.status === 404 || error.message?.includes("no longer available")) {
        throw new HttpsError("unavailable", `AI model "${GEMINI_MODEL}" is unavailable. It has most likely been retired - update GEMINI_MODEL.`, { originalError: "MODEL_UNAVAILABLE" });
      }

      // 4. Parsing Errors (JSON)
      if (error.message?.includes("JSON")) {
        throw new HttpsError("data-loss", "Failed to parse AI response. Please try with clearer text/image.", { originalError: "JSON_PARSE_ERROR" });
      }

      // 4. General / Unknown Errors
      throw new HttpsError("internal", "An unexpected error occurred while processing the list.", {
        message: error.message,
        originalError: "INTERNAL_ERROR"
      });
    }
  }
);
