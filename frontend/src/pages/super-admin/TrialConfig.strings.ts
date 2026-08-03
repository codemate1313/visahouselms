export const trialConfigStrings = {
  title: "Direct-Student Trial",
  description:
    "Governs the free trial for students who sign up directly (not through an institute). Whichever limit is hit first locks the rest of the trial.",
  trialEnabled: "Trial enabled",
  durationLabel: "Trial duration (days)",
  testLimitLabel: "Tests allowed",
  demo: {
    heading: "Demo courses",
    description:
      "Tick the published courses a student may sit for free before subscribing.",
    empty: "No published courses available yet.",
    offered: (count: number) =>
      `${count} course${count === 1 ? "" : "s"} selected as demo`,
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
