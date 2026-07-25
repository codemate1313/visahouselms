export const gradingOversightStrings = {
  eyebrow: "Phase 6 operations",
  title: "Grading Oversight",
  subtitle: "Monitor queue ownership, reevaluation workload, and assisted-evaluation usage.",
  loadError: "Failed to load grading operations.",
  loading: "Loading...",
  stats: {
    unclaimed: "Unclaimed",
    claimed: "Claimed",
    completed: "Completed",
    aiDrafts: "AI drafts this month",
  },
  register: {
    title: "Reevaluation register",
    description: "Latest student review requests across direct and institute accounts.",
    recordsSuffix: "records",
    table: {
      student: "Student",
      course: "Course",
      reason: "Reason",
      status: "Status",
      reviewer: "Reviewer",
      requested: "Requested",
      resolution: "Resolution",
    },
    empty: "No reevaluation requests.",
  },
} as const;
