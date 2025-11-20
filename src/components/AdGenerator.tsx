import React, { useState } from "react";

export const AdGenerator: React.FC = () => {
  const [query, setQuery] = useState(
    "NCAA Division I athletic directors in the United States"
  );
  const [batchSize, setBatchSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch("/api/search-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          batchSize,
          sheetRange: "AD_List!A:D",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      setSummary(
        `Added ${data.added} ADs. Example: ${
          data.preview?.[0]?.school || "n/a"
        } – ${data.preview?.[0]?.name || "n/a"}`
      );
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ad-generator-card" style={{ padding: "1rem", border: "1px solid #e5e7eb", borderRadius: "0.75rem", marginTop: "1.5rem" }}>
      <h2 style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}>
        NIL AD Contact Generator
      </h2>

      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        <div style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}>
          Search focus
        </div>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          style={{ width: "100%", padding: "0.5rem" }}
        />
      </label>

      <label style={{ display: "block", marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "0.9rem", marginBottom: "0.25rem" }}>
          Batch size (per run)
        </div>
        <input
          type="number"
          min={10}
          max={200}
          value={batchSize}
          onChange={(e) => setBatchSize(Number(e.target.value))}
          style={{ width: "100%", padding: "0.4rem" }}
        />
      </label>

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "9999px",
          border: "none",
          cursor: loading ? "default" : "pointer",
        }}
      >
        {loading ? "Generating..." : "Generate AD List"}
      </button>

      {error && (
        <p style={{ color: "crimson", marginTop: "0.75rem" }}>Error: {error}</p>
      )}
      {summary && (
        <p style={{ color: "green", marginTop: "0.75rem" }}>{summary}</p>
      )}
    </div>
  );
};
