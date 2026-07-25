export const contentWorkspaceStrings = {
  title: "Module Workspace",
  subtitle: "Create one self-contained assessment module at a time.",
  areaTypeLabel: "Module",
  createCta: (name: string) => `Create ${name}`,
  areas: [
    { name: "Reading", detail: "5 parts, 30 auto-marked questions and B1–C2 raw-score bands.", type: "reading" },
    { name: "Speaking", detail: "4 equal-weight parts assessed against five 0–8 criteria.", type: "speaking" },
    { name: "Writing", detail: "2 tasks assessed for achievement, grammar, vocabulary and organisation.", type: "writing" },
    { name: "Listening", detail: "4 parts with part-specific MP3 upload or text-to-speech generation.", type: "listening" },
    { name: "Full Mock Test", detail: "One complete 15-part assessment covering all four skills.", type: "full_mock" },
    { name: "Final Test", detail: "A final complete assessment with the same controlled blueprint.", type: "final_test" },
  ],
} as const;
