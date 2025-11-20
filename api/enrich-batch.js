const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

async function enrichSchoolWithAI(school) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const prompt = `
You are helping build a contact database for college athletic departments.

Given this school:
- Name: ${school.school_name}
- State: ${school.state || "Unknown"}
- Conference: ${school.conference || "Unknown"}
- Division: ${school.division || "Unknown"}

1. Identify the current Athletic Director (or equivalent role if AD title differs).
2. Provide:
   - AD full name
   - AD title
   - Best official email (no generic catch-all if possible)
   - Phone number (direct or main athletics office)
3. If available, include an assistant or deputy contact.
4. Provide links (staff directory, athletics site, etc.) as source URLs.
5. Return ONLY JSON with this shape:
{
  "ad_name": "",
  "ad_title": "",
  "ad_email": "",
  "ad_phone": "",
  "assistant_name": "",
  "assistant_email": "",
  "confidence": 0.0,
  "notes": "",
  "source_urls": ["", ""]
}
`;

  const body = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Gemini API error", await res.text());
    throw new Error("Gemini API error");
  }

  const data = await res.json();

  // For JSON responses, Gemini returns JSON string in candidates[0].content.parts[0].text
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", text);
    parsed = {};
  }

  return {
    ad_name: parsed.ad_name || null,
    ad_title: parsed.ad_title || null,
    ad_email: parsed.ad_email || null,
    ad_phone: parsed.ad_phone || null,
    assistant_name: parsed.assistant_name || null,
    assistant_email: parsed.assistant_email || null,
    confidence:
      typeof parsed.confidence === "number" ? parsed.confidence : null,
    notes: parsed.notes || "",
    source_urls: Array.isArray(parsed.source_urls)
      ? parsed.source_urls
      : [],
  };
}
