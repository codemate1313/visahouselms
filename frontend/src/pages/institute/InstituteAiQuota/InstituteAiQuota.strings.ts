export const instituteAiQuotaStrings = {
  title: "AI Evaluation Quota",
  subtitle: "This month's AI grading usage across your students.",
  loading: "Loading...",
  loadError: "Failed to load AI quota usage.",
  perStudent: {
    label: "Per-student quota",
    suffix: "AI evaluations per student, per month",
    platformHint: "Using the platform default — your administrator has not set a custom quota.",
  },
  totalUsed: {
    label: "Used this month",
    suffix: "evaluations across all students",
  },
  table: {
    student: "Student",
    used: "Used",
    remaining: "Remaining",
    status: "Status",
    empty: "No students yet.",
    exhausted: "Exhausted",
    ok: "Within quota",
  },
  readOnlyNote: "Quotas are configured by your platform administrator.",
} as const;
