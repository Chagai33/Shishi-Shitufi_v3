const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '../.env' }); // Try to load from root .env if it exists

async function listModels() {
  const apiKey = process.env.GOOGLE_AI_KEY;

  if (!apiKey) {
    console.error("Error: GOOGLE_AI_KEY environment variable is missing.");
    console.log("Please run this script with your API key:");
    console.log("On Windows (PowerShell): $env:GOOGLE_AI_KEY='YOUR_KEY'; node check_models.js");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    console.log("Fetching available models...");
    // Using the same method as the SDK uses internally to check availability
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (data.models) {
      console.log("\n--- Available Gemini Models ---");
      data.models.forEach(model => {
        if (model.name.includes('gemini')) {
          console.log(`Name: ${model.name.replace('models/', '')}`);
          console.log(`Supported Methods: ${model.supportedGenerationMethods.join(', ')}`);
          console.log('---');
        }
      });
    } else {
      console.error("No models found or error in response:", data);
    }

  } catch (error) {
    console.error("Error listing models:", error.message);
  }
}

listModels();
