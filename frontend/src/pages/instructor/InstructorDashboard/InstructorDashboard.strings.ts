export const instructorDashboardStrings = {
  eyebrow: "Instructor workspace",
  welcome: (firstName: string | undefined) => `Welcome, ${firstName}`,
  subtitle: "Create complete LanguageCert Academic assessment modules.",
  createModule: "Create Module",
  errors: {
    load: "Failed to load your workspace.",
  },
  loading: "Loading...",
  stats: {
    modules: "Modules",
    drafts: "Drafts",
    published: "Published",
    questions: "Questions",
  },
  moduleAuthoring: {
    title: "Module authoring",
    description: "Each module owns its questions, marking rules and media.",
    badge: "Structured authoring",
    skillModulesTitle: "Skill modules",
    skillModulesDetail: (count: number) => `${count} Reading, Listening, Writing and Speaking modules.`,
    completeTestsTitle: "Complete tests",
    completeTestsDetail: (fullMock: number, finalTest: number) =>
      `${fullMock} full mocks and ${finalTest} final tests.`,
    listeningMediaTitle: "Listening media",
    listeningMediaDetail: (count: number) => `${count} uploaded or text-to-speech MP3 files.`,
    openWorkspace: "Open module workspace",
  },
  profileReadiness: {
    title: "Profile readiness",
    description: "A complete profile helps content reviews and ownership.",
    completeYourProfile: "Complete your profile",
  },
  recentActivity: {
    title: "Recent activity",
    description: "Your latest audited account and content actions.",
    empty: "No activity yet.",
  },
} as const;
