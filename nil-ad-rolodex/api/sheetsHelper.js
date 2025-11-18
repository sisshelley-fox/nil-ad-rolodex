// api/sheetsHelper.js
// 🔧 Phase 2 skeleton: stub helpers for Google Sheets integration.

// For now we reuse the same demo schools as /api/schools.
// Later this will read from the Schools_Main sheet.
const DEMO_SCHOOLS = [
  {
    school_id: "uk",
    school_name: "University of Kentucky",
    conference: "SEC",
    division: "NCAA D1",
    state: "KY",
    total_enrollment: 31200,
    student_athlete_count: 500,
  },
  {
    school_id: "uga",
    school_name: "University of Georgia",
    conference: "SEC",
    division: "NCAA D1",
    state: "GA",
    total_enrollment: 38700,
    student_athlete_count: 550,
  },
];

// 👉 Later this will query Google Sheets (Schools_Main tab)
export async function getSchoolsByIds(schoolIds) {
  if (!Array.isArray(schoolIds)) return [];
  return DEMO_SCHOOLS.filter((s) => schoolIds.includes(s.school_id));
}

// 👉 Later this will append rows into AD_Contacts tab
export async function appendADContactsRows(rows) {
  console.log("[sheetsHelper] Would append rows to AD_Contacts:", rows);

  // In the real version, we'll call Google Sheets API here and return the result.
  return {
    insertedCount: Array.isArray(rows) ? rows.length : 0,
  };
}
