export const trialConfigStrings = {
  title: "Direct-Student Trial",
  description:
    "Governs the free trial for students who sign up directly (not through an institute). Whichever limit is hit first locks the rest of the trial.",
  trialEnabled: "Trial enabled",
  durationLabel: "Trial duration (days)",
  courseLimitLabel: "Courses visible",
  testLimitLabel: "Tests allowed",
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
