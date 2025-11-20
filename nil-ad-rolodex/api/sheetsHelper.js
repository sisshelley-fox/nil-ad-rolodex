// api/sheetsHelper.js
// Real Google Sheets helper using a service account.

import { google } from "googleapis";

function getSheetsClient() {
  const {
    GOOGLE_PROJECT_ID,
    GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_SHEET_ID,
  } = process.env;

  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
    throw new Error("Missing Google Sheets environment variables");
  }

  const auth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  return { sheets, sheetId: GOOGLE_SHEET_ID };
}

// 👉 Read schools by ID from Schools_Main
export async function getSchoolsByIds(schoolIds) {
  const { sheets, sheetId } = getSheetsClient();

  // Adjust range & columns to match your actual Schools_Main layout
  const range = "Schools_Main!A2:Z"; // assumes row 1 is headers

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
  });

  const rows = res.data.values || [];
  if (!rows.length) return [];

  // Map headers to columns
  // Example assumption:
  // A: school_id, B: school_name, C: conference, D: division, E: state, F: total_enrollment, G: student_athlete_count
  const schools = rows.map((row) => ({
    school_id: row[0],
    school_name: row[1],
    conference: row[2],
    division: row[3],
    state: row[4],
    total_enrollment: row[5] ? Number(row[5]) : null,
    student_athlete_count: row[6] ? Number(row[6]) : null,
  }));

  return schools.filter((s) => schoolIds.includes(s.school_id));
}

// 👉 Append AD contact rows into AD_Contacts sheet
export async function appendADContactsRows(enrichedRows) {
  const { sheets, sheetId } = getSheetsClient();

  if (!Array.isArray(enrichedRows) || enrichedRows.length === 0) {
    return { insertedCount: 0 };
  }

  // Define columns for AD_Contacts tab
  // Adjust to match your Sheet: A: school_id, B: school_name, C: ad_name, D: ad_title, E: ad_email, F: ad_phone,
  // G: assistant_name, H: assistant_email, I: confidence, J: notes, K: source_urls, L: created_at
  const values = enrichedRows.map((r) => [
    r.school_id || "",
    r.school_name || "",
    r.ad_name || "",
    r.ad_title || "",
    r.ad_email || "",
    r.ad_phone || "",
    r.assistant_name || "",
    r.assistant_email || "",
    r.confidence != null ? r.confidence : "",
    r.notes || "",
    Array.isArray(r.source_urls) ? r.source_urls.join(" ") : "",
    new Date().toISOString(),
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "AD_Contacts!A2", // appends after existing
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });

  return { insertedCount: values.length };
}
