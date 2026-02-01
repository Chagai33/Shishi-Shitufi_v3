const { onCall, HttpsError } = require("firebase-functions/v2/https");
// Force Deploy Update: 2026-02-01 12:15
const { defineSecret } = require("firebase-functions/params");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const googleAiKey = defineSecret("GOOGLE_AI_KEY");

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

    const { text, image, mimeType } = request.data;

    // Validate: Must have either text or image
    if ((!text || typeof text !== "string" || text.trim().length === 0) && (!image || typeof image !== "string")) {
      throw new HttpsError("invalid-argument", "Please provide a shopping list text or image.");
    }

    try {
      // 3. Initialize Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      // 4. Golden Prompt
      const systemPrompt = `You are a Hebrew shopping list parser. Convert input (text or image) to strict JSON array: [{ name: string, quantity: number }]. 
      Rules:
      - Handle slang (e.g., '2 חלב', 'חלב פעמיים' -> quantity: 2).
      - Clean names (remove 'bottles of', 'packages of', etc.).
      - Default quantity = 1.
      - Output ONLY valid JSON.`;

      const parts = [systemPrompt];
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

      // 3. Parsing Errors (JSON)
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
