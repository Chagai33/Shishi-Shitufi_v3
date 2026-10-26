/**
 * What the smart import decides: whether a request is worth sending, in what
 * order the deciding happens, and what a failure of the model actually was.
 *
 * Its own file, and with no require of its own, for one reason. The decisions
 * here are the ones worth testing, and functions/smartImport.js cannot be
 * loaded outside a deployed function: its first line reaches for
 * firebase-functions, and functions/node_modules is not installed in this
 * repository at all. Nothing in this file is reached that way, so every
 * decision below can be called from `node --test` as the repository stands.
 *
 * It therefore holds no database, no network and no HttpsError. The handler
 * passes in what touches those, which is also what lets a test hold a counter
 * and watch whether it moved.
 *
 * See DOCS/PLANING/53-ai-limits-and-costs.md and
 * DOCS/PLANING/125-you-cannot-tell-who-spent-the-credit.md.
 */

// How many calls one signed-in identity may make, in two windows at once.
//
// Two windows rather than one because they stop two different things: the hour
// stops a loop, and the day stops slow grinding. Both numbers are deliberately
// generous, since a real organiser uses the smart import once or twice for an
// event. The ceiling is here to stop abuse, not use.
//
// They live inside functions/ and not in src/constants/limits.json, where every
// other ceiling in the product lives, because a deployed function carries only
// what is inside functions/ and cannot read that file. Nothing outside this
// function needs these two numbers, so there is no second copy to drift from.
const CALLS_PER_HOUR = 5;
const CALLS_PER_DAY = 20;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * A refusal, in this project's own terms rather than in the terms of
 * firebase-functions.
 *
 * The handler turns one of these into an HttpsError in a single place. Nothing
 * here may build an HttpsError itself, because building one means requiring
 * firebase-functions, and that is exactly what would stop a test from loading
 * this file.
 *
 * The code is the HttpsError code the screens will read, and details is what
 * src/utils/smartImportErrors.ts looks at to tell two meanings of one code
 * apart. The message is for the log and is never put on screen; the rule is
 * written at the head of that file.
 */
class ImportRefusal extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = "ImportRefusal";
    this.code = code;
    this.details = details;
  }
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
 * Whether this request carries something worth sending anywhere.
 *
 * Returns a refusal, or null when there is nothing wrong. One function and not
 * three checks spread through the handler, because the ordering this file
 * exists to hold is only readable if "the input is valid" happens at a single
 * moment that the counter can be placed after.
 */
function validateInput(data) {
  const { text, image } = data || {};

  // Must have either text or image.
  if (
    (!text || typeof text !== "string" || text.trim().length === 0) &&
    (!image || typeof image !== "string")
  ) {
    return new ImportRefusal("invalid-argument", "Please provide a shopping list text or image.");
  }

  // Marked, because the screens have to tell this apart from the other things
  // invalid-argument means. It is the one an organiser can walk into by having
  // a large event rather than by sending something wrong, and being told the
  // text is invalid does not help them.
  //
  // The ceiling is written out rather than named, because
  // test/rules/limits.test.mjs reads this line as text in order to keep it
  // equal to aiTextMax in src/constants/limits.json. The screens hold the same
  // number so they can say so before sending, and that test is what stops the
  // three copies drifting apart.
  if (text && text.length > 2000) {
    return new ImportRefusal("invalid-argument", "Text too long. Max 2000 characters.", {
      originalError: "TEXT_TOO_LONG",
    });
  }

  // Base64 string length check: 5MB image ≈ 6.7MB base64.
  // Setting limit to 7,000,000 chars to be safe.
  if (image && image.length > 7000000) {
    return new ImportRefusal("invalid-argument", "Image too large. Max 5MB.");
  }

  return null;
}

/**
 * What a failure of the model itself was, said as a refusal.
 *
 * Only ever reached for a call that got as far as the model, so everything it
 * returns describes the model or the answer it gave, and never the request.
 */
function classifyModelError(error, modelName) {
  // 1. Quota / Billing Errors
  if (
    error.message?.includes("429") ||
    error.message?.includes("quota") ||
    error.message?.includes("exhausted")
  ) {
    return new ImportRefusal("resource-exhausted", "AI quota exceeded. Please try again later.", {
      originalError: "QUOTA_EXCEEDED",
    });
  }

  // 2. Safety / Policy Errors
  if (error.response?.promptFeedback?.blockReason || error.message?.includes("blocked")) {
    return new ImportRefusal("failed-precondition", "The input was blocked by AI safety filters.", {
      originalError: "SAFETY_BLOCK",
    });
  }

  // 3. Retired / unknown model - surfaces as a 404 from the Gemini API
  if (error.status === 404 || error.message?.includes("no longer available")) {
    return new ImportRefusal(
      "unavailable",
      `AI model "${modelName}" is unavailable. It has most likely been retired - update GEMINI_MODEL.`,
      { originalError: "MODEL_UNAVAILABLE" },
    );
  }

  // 4. Parsing Errors (JSON)
  if (error.message?.includes("JSON")) {
    return new ImportRefusal(
      "data-loss",
      "Failed to parse AI response. Please try with clearer text/image.",
      { originalError: "JSON_PARSE_ERROR" },
    );
  }

  // 5. General / Unknown Errors
  return new ImportRefusal(
    "internal",
    "An unexpected error occurred while processing the list.",
    { message: error.message, originalError: "INTERNAL_ERROR" },
  );
}

/**
 * The order the three steps happen in, and the reason this file exists.
 *
 * Input first, then the count, then the model.
 *
 * The count used to come first, before the arguments were looked at. An
 * organiser who pressed the button with an empty box, or who pasted a list
 * longer than the ceiling, lost one of their five calls an hour for a typing
 * mistake. It cost nobody money, because the model was never reached. It cost
 * the organiser their own allowance, which is the thing the ceiling was never
 * meant to take. Product owner, 25/10/2026, and the record is
 * DOCS/PLANING/125-you-cannot-tell-who-spent-the-credit.md, part B.
 *
 * And the half of the old reasoning that stays true, which is the line not to
 * cross: anything that reached the model is counted, including a call the model
 * failed. A refund on failure would be its own way through, since a caller who
 * can make the model fail could then call without limit. So the boundary is
 * exactly this: invalid input is not counted, and everything past validateInput
 * is counted, answer or no answer.
 *
 * charge and callModel are passed in rather than reached for, so that a test
 * can hold a counter and prove where that boundary sits. modelName is passed
 * in for the same reason: it is only needed in order to name a retired model in
 * a log line, and reading it here would mean reading the environment.
 */
async function runImport({ data, charge, callModel, modelName }) {
  const refusal = validateInput(data);
  if (refusal) throw refusal;

  // Outside the try below on purpose, as it was before it moved here. That
  // catch reads the message of whatever it is given and would turn a rate limit
  // refusal into a report about the model.
  await charge();

  try {
    return await callModel();
  } catch (error) {
    console.error("Smart Import Error Details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    throw classifyModelError(error, modelName);
  }
}

module.exports = {
  CALLS_PER_HOUR,
  CALLS_PER_DAY,
  ImportRefusal,
  classifyModelError,
  rateLimit,
  runImport,
  validateInput,
};
