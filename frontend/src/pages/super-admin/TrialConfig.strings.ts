export const trialConfigStrings = {
  title: "Direct-Student Trial",
  description:
    "Governs the free trial for students who sign up directly (not through an institute). Whichever limit is hit first locks the rest of the trial.",
  trialEnabled: "Trial enabled",
  durationLabel: "Trial duration (days)",
  courseLimitLabel: "Courses visible",
  testLimitLabel: "Tests allowed",
  demo: {
    heading: "Demo courses",
    description:
      "Tick the published courses a student may sit for free before subscribing. The first N ticked courses are offered, where N is \"Courses visible\" above.",
    empty: "No published courses available yet.",
    offered: (count: number, limit: number) =>
      count <= limit
        ? `${count} of ${limit} allowed course${limit === 1 ? "" : "s"} offered`
        : `${count} ticked, but only the first ${limit} will be offered`,
    beyondLimit: "Beyond the visible limit",
    save: "Save demo courses",
    saving: "Saving...",
    saved: "Demo courses updated.",
    error: "Failed to update demo courses.",
  },
  loading: "Loading...",
  saving: "Saving...",
  save: "Save",
  errors: {
    save: "Failed to save trial settings.",
  },
  notices: {
    saved: "Trial settings saved.",
  },
} as const;
