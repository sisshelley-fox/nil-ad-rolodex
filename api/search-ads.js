import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const prompt = `Generate a list of NCAA Division I athletic directors in the United States. 
    Return only name, title, and email if known. Keep output structured.`;

    const result = await model.generateContent(prompt);

    const text = result.response.text();

    res.status(200).json({ data: text });

  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: error.message });
  }
}
