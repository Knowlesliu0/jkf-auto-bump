const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

async function testModels() {
    console.log("Testing Gemini API models...");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const modelsToTest = ['gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-lite-preview-02-05', 'gemini-1.5-pro', 'gemini-2.0-flash'];

    for (const modelName of modelsToTest) {
        try {
            console.log(`\nTesting ${modelName}...`);
            const aiResponse = await ai.models.generateContent({
                model: modelName,
                contents: "Hello",
            });
            console.log(`SUCCESS [${modelName}]:`, aiResponse.text);
        } catch (e) {
            console.error(`FAILED [${modelName}]: ${e.message}`);
        }
    }
}

testModels();
