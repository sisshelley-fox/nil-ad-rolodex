import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  const schools = [
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

  res.status(200).json(schools);
}
