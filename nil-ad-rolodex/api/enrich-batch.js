// api/enrich-batch.js
// 🔧 Phase 2 skeleton: batch enrichment endpoint.
// Uses sheetsHelper + a fake AI enrichment fn for now.

import { getSchoolsByIds, appendADContactsRows } from "./sheetsHelper.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // Simple GET mode for easy testing:
      // /api/enrich-batch?ids=uk,uga
      const urlObj = new URL(req.url, "http://localhost");
      const idsParam = urlObj.searchParams.get("ids");
      const schoolIds = idsParam ? idsParam.split(",").map((id) => id.trim()) : [];

      if (schoolIds.length === 0) {
        res
          .status(400)
          .json({ error: "Provide ?ids=uk,uga (comma-separated school_ids)" });
        return;
      }

      const result = await processBatch(schoolIds);
      res.status(200).json({ mode: "GET-demo", ...result });
      return;
    }

    if (req.method === "POST") {
      // Real batch mode:
      // body: { "schoolIds": ["uk", "uga"] }
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const schoolIds = body.schoolIds;

      if (!Array.isArray(schoolIds) || schoolIds.length === 0) {
        res
          .status(400)
          .json({ error: "Body must include { schoolIds: [\"uk\", \"uga\"] }" });
        return;
      }

      const result = await processBatch(schoolIds);
      res.status(200).json({ mode: "POST", ...result });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed. Use GET or POST." });
  } catch (err) {
    console.error("Error in /api/enrich-batch:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function processBatch(schoolIds) {
  // 1) Look up base school data (later from Google Sheets)
  const schools = await getSchoolsByIds(schoolIds);

  // 2) "Enrich" with fake AI for now
  const enriched = await Promise.all(
    schools.map(async (school) => {
      const aiResult = await fakeEnrichSchoolWithAI(school);
      return {
        school_id: school.school_id,
        school_name: school.school_name,
        ...aiResult,
      };
    })
  );

  // 3) "Write" to AD_Contacts (stub just logs for now)
  const sheetsResult = await appendADContactsRows(enriched);

  return {
    requestedCount: schoolIds.length,
    foundSchools: schools.length,
    enrichedCount: enriched.length,
    sheetsResult,
  };
}

// 👉 This will later call Gemini with your API key.
async function fakeEnrichSchoolWithAI(school) {
  return {
    ad_name: `Demo AD for ${school.school_name}`,
    ad_title: "Athletic Director",
    ad_email: `ad@${school.school_id}.edu`,
    ad_phone: "555-000-0000",
    assistant_name: null,
    assistant_email: null,
    confidence: 0.1,
    notes: "Demo enrichment data – replace with Gemini result.",
    source_urls: [],
  };
}
