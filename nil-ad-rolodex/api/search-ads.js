// api/search-ads.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";

function getSheetsClient() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  const base64Key = process.env.GOOGLE_PRIVATE_KEY_B64;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !serviceEmail || (!base64Key && !rawKey)) {
    throw new Error(
      "Missing one of GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY(_B64)"
    );
  }

  let privateKey;

  if (base64Key) {
    // Decode the Base64-encoded PEM
    privateKey = Buffer.from(base64Key, "base64").toString("utf8");
  } else {
    // Local fallback: handle \n-escaped key in .env
    privateKey = rawKey;
    if (privateKey.includes("\\n")) {
      privateKey = privateKey.replace(/\\n/g, "\n");
    }
  }

  const jwtClient = new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth: jwtClient });

  return { sheets, spreadsheetId };
}


export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const bodyChunks = [];
    for await (const chunk of req) {
      bodyChunks.push(chunk);
    }
    const bodyString = Buffer.concat(bodyChunks).toString("utf8");
    const body = bodyString ? JSON.parse(bodyString) : {};

    const {
      query,
      batchSize = 50,
      sheetRange = "AD_List!A:D", // Tab!columns
    } = body;

    const effectiveQuery =
      query ||
      "Generate a list of NCAA Division I athletic directors in the US with school, AD name, title, and email if publicly available.";

    const { sheets, spreadsheetId } = getSheetsClient();

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
You are helping build a list of US college Athletic Directors for NIL outreach.

Return up to ${batchSize} records as STRICT JSON ONLY with this shape:

[
  {
    "school": "string",
    "name": "string",
    "title": "string",
    "email": "string | null if unknown"
  }
]

Rules:
- Use only publicly available information.
- If you are unsure of an email, set it to null.
- Do NOT include any extra commentary or text outside the JSON array.

Query focus: ${effectiveQuery}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Clean off code fences if Gemini adds them
    const cleaned = responseText
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    let rows;
    try {
      rows = JSON.parse(cleaned);
    } catch (e) {
      console.error("JSON parse error from Gemini:", e, responseText);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Failed to parse Gemini response as JSON",
          rawResponse: responseText,
        })
      );
      return;
    }

    if (!Array.isArray(rows)) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "Gemini response was not an array",
          rawResponse: responseText,
        })
      );
      return;
    }

    const values = rows.map((r) => [
      r.school || "",
      r.name || "",
      r.title || "",
      r.email || "",
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: sheetRange,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        status: "ok",
        added: values.length,
        preview: rows.slice(0, 5),
      })
    );
  } catch (err) {
    console.error("Error in /api/search-ads:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Upstream error",
        details: err.message || String(err),
      })
    );
  }
}
