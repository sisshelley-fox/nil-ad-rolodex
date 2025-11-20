// api/search-ads.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { google } from "googleapis";

// ==== Google Sheets client (service account) ====

function getSheetsClient() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing one of GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY"
    );
  }

  // Fix escaped newlines in the private key (common on Vercel)
  privateKey = privateKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT(
    clientEmail,
    undefined,
    privateKey,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  return { sheets, spreadsheetId };
}

// ==== Gemini model ====

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Columns we expect in the Contacts_AD_NIL sheet, in order.
// Make your header row in Contacts_AD_NIL match this order.
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
  "notes"
];

// ==== API handler ====

/**
 * POST /api/search-ads
 * Body: { query: string, batchSize?: number }
 * Response: { added: number, preview: any[] }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Missing GEMINI_API_KEY");
    }

    const { query, batchSize } = req.body || {};

    if (!query || typeof query !== "string") {
      return res
        .status(400)
        .json({ error: "Missing or invalid 'query' in request body" });
    }

    const sizeRaw = Number(batchSize) || 10;
    const size = Math.max(1, Math.min(sizeRaw, 50)); // 1–50 per run

    // 1) Ask Gemini for rows shaped exactly like the sheet

   const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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

Example structure (keys only, values are examples):

[
  {
    "school_id": "uk",
    "school_name": "University of Kentucky",
    "school_short_name": "Kentucky",
    "association": "NCAA",
    "division": "NCAA D1",
    "conference": "SEC",
    "state": "KY",
    "city": "Lexington",
    "athletic_director_name": "Mitch Barnhart",
    "athletic_director_title": "Athletic Director",
    "athletic_director_email": "ad@example.edu",
    "athletic_director_phone": null,
    "staff_directory_url": "https://ukathletics.com/staff-directory/...",
    "linkedin_url": null,
    "nil_policy_url": null,
    "data_quality_score": 0.85,
    "last_verified_date": "2025-01-01",
    "verified_by": null,
    "created_at": "2025-01-01T12:00:00Z",
    "created_by": "NIL_AD_Rolodex_v1",
    "notes": "Public AD contact, may route via staff."
  }
]
    `.trim();

    const geminiResult = await model.generateContent(prompt);
    const geminiResponse = await geminiResult.response;

    let text = (geminiResponse.text() || "").trim();

    // Strip ```json fences if they appear
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

    // Normalize each row to our CONTACT_COLUMNS
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

    // 2) Append to Google Sheets: Contacts_AD_NIL
    const { sheets, spreadsheetId } = getSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Contacts_AD_NIL!A:Z", // assumes headers already exist in row 1
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: rows,
      },
    });

    // (Optional) log to Change_Log (if the sheet exists)
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
      // Don't blow up the main request if logging fails
      console.warn("Change_Log append failed (non-fatal):", logErr.message);
    }

    // 3) Respond to the frontend
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
