import React, { useState } from "react";
import { AdGenerator } from "./AdGenerator"; // ✅ NEW

interface SchoolRow {
  school_id: string;
  school_name: string;
  conference?: string;
  division?: string;
  state?: string;
  total_enrollment?: number;
  student_athlete_count?: number;
}

const MOCK_SCHOOLS: SchoolRow[] = [
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

const AthleticDirectorRolodex: React.FC = () => {
  const [selectedSchool, setSelectedSchool] = useState<SchoolRow | null>(null);

  return (
    <main style={{ minHeight: "100vh", background: "#020617", color: "#e5e7eb" }}>
      <section style={{ maxWidth: "1100px", margin: "0 auto", padding: "1.5rem" }}>
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Athletic Director Rolodex</h1>
            <p style={{ fontSize: "0.85rem", color: "#9ca3af", marginTop: "0.25rem" }}>
              Search schools, enrich with AI, and manage AD / NIL contacts in one shared place.
            </p>
          </div>
        </header>

        {/* Simple layout: list on left, details + generator on right */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.3fr)",
            gap: "1rem",
          }}
        >
          {/* Schools list */}
          <div
            style={{
              background: "#020617",
              borderRadius: "0.5rem",
              border: "1px solid #1f2937",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                borderBottom: "1px solid #1f2937",
                padding: "0.5rem 0.75rem",
                fontSize: "0.75rem",
                color: "#9ca3af",
              }}
            >
              {MOCK_SCHOOLS.length} schools (demo data)
            </div>
            <table style={{ width: "100%", fontSize: "0.8rem" }}>
              <thead style={{ background: "#020617" }}>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>School</th>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Conf</th>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>Div</th>
                  <th style={{ textAlign: "left", padding: "0.5rem 0.75rem" }}>State</th>
                  <th style={{ textAlign: "right", padding: "0.5rem 0.75rem" }}>
                    Students / Athletes
                  </th>
                </tr>
              </thead>
              <tbody>
                {MOCK_SCHOOLS.map((school) => (
                  <tr
                    key={school.school_id}
                    style={{
                      borderTop: "1px solid #1f2937",
                      cursor: "pointer",
                      background:
                        selectedSchool?.school_id === school.school_id
                          ? "#111827"
                          : "transparent",
                    }}
                    onClick={() => setSelectedSchool(school)}
                  >
                    <td style={{ padding: "0.5rem 0.75rem" }}>{school.school_name}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{school.conference}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{school.division}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{school.state}</td>
                    <td style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>
                      {school.total_enrollment?.toLocaleString() ?? "—"}
                      {school.student_athlete_count != null && (
                        <>
                          <span style={{ color: "#6b7280" }}> / </span>
                          {school.student_athlete_count.toLocaleString()}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Details panel */}
          <aside
            style={{
              background: "#020617",
              borderRadius: "0.5rem",
              border: "1px solid #1f2937",
              padding: "0.75rem",
              minHeight: "8rem",
              fontSize: "0.8rem",
            }}
          >
            {!selectedSchool && (
              <p style={{ color: "#9ca3af" }}>
                Select a school from the list to view details and run AI enrichment.
              </p>
            )}

            {selectedSchool && (
              <div>
                <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  {selectedSchool.school_name}
                </h2>
                <p style={{ color: "#9ca3af", marginTop: "0.15rem" }}>
                  {selectedSchool.division} • {selectedSchool.conference} •{" "}
                  {selectedSchool.state}
                </p>
                <p style={{ marginTop: "0.5rem" }}>
                  {selectedSchool.total_enrollment &&
                    `${selectedSchool.total_enrollment.toLocaleString()} students`}
                  {selectedSchool.student_athlete_count != null && (
                    <>
                      <span style={{ color: "#6b7280" }}> • </span>
                      {selectedSchool.student_athlete_count.toLocaleString()} student-athletes
                    </>
                  )}
                </p>

                {/* 🔥 Drop the AD Generator here */}
                <div style={{ marginTop: "0.75rem" }}>
                  <AdGenerator />
                </div>
              </div>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
};

export default AthleticDirectorRolodex;
