// api/search-ads.js

import { google } from "googleapis";

// ===================== Google Sheets helper ===================== //

function getSheetsClient() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !serviceEmail || !privateKey) {
    throw new Error(
      "Missing one of GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY"
    );
  }

  // Vercel / env often store private keys with literal "\n". Fix that:
  if (privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  const auth = new google.auth.JWT({
    email: serviceEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  return { sheets, spreadsheetId };
}

// ===================== Gemini via raw HTTP ===================== //

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

/**
 * Call Gemini using the HTTP REST API (not the SDK).
 * Uses v1/models/gemini-1.5-flash:generateContent
 */
async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" +
    encodeURIComponent(GEMINI_API_KEY);

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Gemini API error:", resp.status, errText);
    throw new Error(
      `Gemini API error: ${resp.status} ${resp.statusText} - ${errText}`
    );
  }

  const data = await resp.json();

  const parts =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text || "") || [];

  const text = parts.join("").trim();

  if (!text) {
    throw new Error("Gemini returned empty text");
  }

  return text;
}

// ===================== Sheet column definition ===================== //

const CONTACT_COLUMNS = [
  "school_id",
  "school_name",
  "school_short_name",
  "association",
  "division",
  "conference",
  "state",
  "city",
  "athletic_director_name",
  "athletic_director_title",
  "athletic_director_email",
  "athletic_director_phone",
  "staff_directory_url",
  "linkedin_url",
  "nil_policy_url",
  "data_quality_score",
  "last_verified_date",
  "verified_by",
  "created_at",
  "created_by",
  "notes",
];

// ===================== API handler ===================== //

/**
 * POST /api/search-ads
 * Body: { query: string, batchSize?: number }
 * Response: { added: number, preview: any[], message?: string }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, batchSize } = req.body || {};

    if (!query || typeof query !== "string") {
      return res
        .status(400)
        .json({ error: "Missing or invalid 'query' in request body" });
    }

    const sizeRaw = Number(batchSize) || 10;
    const size = Math.max(1, Math.min(sizeRaw, 50)); // 1–50 per run

    // 1) Build prompt for Gemini
    const prompt = `
You are helping build a Google Sheet for The Collective Engine called "Contacts_AD_NIL".
Each row represents ONE college athletic director or NIL decision-maker.

The target sheet has these columns in EXACT order (keys must match exactly):

${CONTACT_COLUMNS.join(", ")}

Using ONLY public, non-sensitive information, generate up to ${size} NEW rows
for this user query:

"${query}"

Rules:
- Each item must be a JSON object with ONLY the keys listed above.
- Use null or "" when data is not confidently available.
- "school_id" should be a short, slug-like ID (e.g., "uk" or "uga") if you can infer it, else "".
- "created_at" should be an ISO timestamp string (UTC) when you generated this data.
- "created_by" should be "NIL_AD_Rolodex_v1".
- "data_quality_score" should be a number between 0 and 1 representing your confidence.
- "last_verified_date" is the date you believe the AD info was last valid, if you can infer it.

Return ONLY a JSON array. No markdown, no commentary, no extra text.
    `.trim();

    // 2) Call Gemini via HTTP
    let text = await callGemini(prompt);

    // Strip ```json fences if it decides to be cute
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("Failed to parse Gemini JSON:", text);
      throw new Error("Gemini did not return valid JSON");
    }

    if (!Array.isArray(parsed)) {
      throw new Error("Gemini output was not a JSON array");
    }

    // 3) Normalize to CONTACT_COLUMNS order
    const contacts = parsed.map((item) => {
      const obj = {};
      for (const key of CONTACT_COLUMNS) {
        obj[key] = item[key] ?? "";
      }
      return obj;
    });

    if (contacts.length === 0) {
      return res.status(200).json({
        added: 0,
        preview: [],
        message: "Gemini returned no contacts for this query.",
      });
    }

    const rows = contacts.map((contact) =>
      CONTACT_COLUMNS.map((key) => contact[key])
    );

    // 4) Append to Google Sheets: Contacts_AD_NIL
    const { sheets, spreadsheetId } = getSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Contacts_AD_NIL!A:Z", // assumes headers in row 1
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: rows,
      },
    });

    // 5) Log to Change_Log (non-fatal if it fails)
    try {
      const timestamp = new Date().toISOString();
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Change_Log!A:D",
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [[timestamp, query, contacts.length, "OK"]],
        },
      });
    } catch (logErr) {
      console.warn("Change_Log append failed (non-fatal):", logErr.message);
    }

    // 6) Respond to frontend
    return res.status(200).json({
      added: contacts.length,
      preview: contacts.slice(0, 3),
    });
  } catch (error) {
    console.error("Error in /api/search-ads:", error);
    return res.status(500).json({
      error: error.message || "Internal server error",
    });
  }
}
