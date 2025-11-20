// scripts/test-sheets.js
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();
console.log("Loaded env:");
console.log("  SHEET ID:", process.env.GOOGLE_SHEETS_ID ? "✅ set" : "❌ missing");
console.log("  SERVICE EMAIL:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "❌ missing");
console.log(
  "  PRIVATE KEY:",
  process.env.GOOGLE_PRIVATE_KEY
    ? `✅ set (length ${process.env.GOOGLE_PRIVATE_KEY.length})`
    : "❌ missing"
);

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !serviceEmail || !privateKey) {
    console.error(
      "❌ Missing one of GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY"
    );
    process.exit(1);
  }

  // Convert literal "\n" into real newlines for the private key
  privateKey = privateKey.replace(/\\n/g, "\n");

  console.log("✅ Env vars loaded. Connecting to Google Sheets...");

 const jwtClient = new google.auth.JWT({
  email: serviceEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});


  await jwtClient.authorize();

  const sheets = google.sheets({ version: "v4", auth: jwtClient });

  const now = new Date().toISOString();

  const values = [
    ["TEST SCHOOL", "Test User", "Test Title", `test+${now}@example.com`],
  ];

  const range = "AD_List!A:D";

  const result = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });

  console.log("✅ Append result:", JSON.stringify(result.data, null, 2));
  console.log("🎉 SUCCESS: Wrote a test row to AD_List! Check your Sheet.");
}

main().catch((err) => {
  console.error("❌ Error in test-sheets:", err);
  process.exit(1);
});
