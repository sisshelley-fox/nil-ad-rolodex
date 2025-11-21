// api/search-ads.js
// NIL AD Rolodex – Search + Gemini Structured JSON Generator (v1)

// ---------- Gemini REST v1 Endpoint (Correct) ----------
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

// ---------- Gemini Caller ----------
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg = data?.error?.message || "Unknown Gemini error";
    console.error("Gemini raw error:", data);
    throw new Error(`Gemini API error: ${resp.status} ${msg}`);
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || "")
      .join("") || "";

  return text.trim();
}

// ---------- Build Dynamic Prompt With Batch Size ----------
function buildPrompt(query, batchSize) {
  return `
You are generating structured NCAA Athletic Director contact data for The Collective Engine.

Task:
Return exactly ${batchSize} HIGH-QUALITY, REALISTIC *fictional but plausible* NCAA athletic director contacts
that match the search focus below:

Search focus:
"${query}"

OUTPUT FORMAT (STRICT JSON ONLY — NO commentary):
[
  {
    "school_name": "",
    "school_short_name": "",
    "conference": "",
    "division": "",
    "state": "",
    "city": "",
    "ad_full_name": "",
    "ad_title": "",
    "ad_email": "",
    "ad_linkedin_url": "",
    "source_url": ""
  }
]

RULES:
- All rows must be unique.
- Only NCAA schools.
- Emails must be realistic formats.
- Keep titles realistic (AD, Deputy AD, Associate AD).
- If you cannot find enough perfect matches, still return ${batchSize} realistic rows.
`;
}

// ---------- API Route Handler ----------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query, batchSize } = req.body || {};

    const limit = Math.max(1, Math.min(Number(batchSize) || 5, 25));

    const prompt = buildPrompt(
      query || "NCAA Division I athletic directors in the United States",
      limit
    );

    let geminiText = "";
    let geminiError = null;

    try {
      geminiText = await callGemini(prompt);
    } catch (err) {
      geminiError = err.message || "Unknown Gemini error";
      console.error("Gemini call error:", err);
    }

    // ---------- JSON PARSING ----------
    let parsed = [];
    if (geminiText) {
      try {
        // Try strict parsing
        const jsonStart = geminiText.indexOf("[");
        const jsonEnd = geminiText.lastIndexOf("]");
        const jsonString = geminiText.slice(jsonStart, jsonEnd + 1);

        parsed = JSON.parse(jsonString);
      } catch (err) {
        console.error("JSON parse failure:", err);
      }
    }

    // ---------- If Gemini Returned Nothing ----------
    if (!Array.isArray(parsed) || parsed.length === 0) {
      parsed = [
        {
          school_name: "University of Kentucky",
          school_short_name: "UK",
          conference: "SEC",
          division: "NCAA D1",
          state: "KY",
          city: "Lexington",
          ad_full_name: "Jordan Blake",
          ad_title: "Athletic Director",
          ad_email: "jordan.blake@uky.edu",
          ad_linkedin_url: "https://linkedin.com/in/sample",
          source_url: "https://www.uky.edu",
        },
        {
          school_name: "University of Georgia",
          school_short_name: "UGA",
          conference: "SEC",
          division: "NCAA D1",
          state: "GA",
          city: "Athens",
          ad_full_name: "Riley Morgan",
          ad_title: "Senior Associate AD",
          ad_email: "riley.morgan@uga.edu",
          ad_linkedin_url: "https://linkedin.com/in/sample",
          source_url: "https://www.uga.edu",
        },
      ].slice(0, limit);
    }

    // ---------- Trim To Batch Size ----------
    const finalList = parsed.slice(0, limit);

    return res.status(200).json({
      added: finalList.length,
      preview: finalList,
      geminiError,
    });
  } catch (err) {
    console.error("Fatal error in /api/search-ads:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.message || String(err),
    });
  }
}
