export const instructorDashboardStrings = {
  eyebrow: "Instructor workspace",
  welcome: (firstName: string | undefined) => `Welcome, ${firstName}`,
  subtitle: "Track the reach of your published courses and your grading contribution.",
  createModule: "Create Module",
  errors: {
    load: "Failed to load your workspace.",
  },
  loading: "Loading...",
  stats: {
    gradings: "Gradings completed",
    learners: "Learners reached",
    published: "Published courses",
    attempts: "Course attempts",
  },
  impact: {
    title: "Instructor impact",
    description: "How consistently your published courses are being discovered and completed.",
    adoption: "Course adoption",
    adoptionDetail: (used: number, published: number) => `${used} of ${published} published courses have learner activity.`,
    completion: "Attempt completion",
    completionDetail: (completed: number, attempts: number) => `${completed} of ${attempts} attempts have reached a graded result.`,
    gradedThisMonth: " graded this month",
    inProgress: " currently in progress",
  },
  analytics: {
    learnersTitle: "Learners by published course",
    learnersAriaLabel: "Distinct learners using each published course",
    learnersEmpty: "Learner usage will appear after students start your published courses.",
    learnerSubtext: (attempts: number) => `${attempts} attempts`,
    gradingTitle: "Grading activity - last 6 months",
    gradingAriaLabel: "Distinct attempts graded by the instructor during the last six months",
    gradingEmpty: "Completed gradings will build your six-month activity trend.",
  },
  courseUsage: {
    title: "Published course usage",
    description: "Learner reach, attempts and completion for every course you have published.",
    badge: (count: number) => `${count} published`,
    emptyTitle: "No published courses yet",
    emptyDescription: "Publish a course to begin tracking learner usage here.",
    gradedDetail: (count: number) => `${count} graded ${count === 1 ? "attempt" : "attempts"}`,
    columns: {
      course: "Course",
      type: "Type",
      learners: "Learners",
      attempts: "Attempts",
      completion: "Completion",
    },
  },
  moduleAuthoring: {
    title: "Module authoring",
    description: "Each module owns its questions, marking rules and media.",
    badge: "Structured authoring",
    skillModulesTitle: "Skill modules",
    skillModulesDetail: ({
      reading,
      listening,
      writing,
      speaking,
    }: {
      reading: number;
      listening: number;
      writing: number;
      speaking: number;
    }) => {
      const total = reading + listening + writing + speaking;
      if (total === 0) return "0 Reading, Listening, Writing and Speaking modules.";
      const parts: string[] = [];
      if (reading > 0) parts.push(`${reading} Reading`);
      if (listening > 0) parts.push(`${listening} Listening`);
      if (writing > 0) parts.push(`${writing} Writing`);
      if (speaking > 0) parts.push(`${speaking} Speaking`);

      if (parts.length === 1) {
        return `${parts[0]} ${total === 1 ? "module" : "modules"}.`;
      }
      if (parts.length === 2) {
        return `${parts[0]} and ${parts[1]} modules.`;
      }
      return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]} modules.`;
    },
    completeTestsTitle: "Complete tests",
    completeTestsDetail: (fullMock: number, finalTest: number) =>
      `${fullMock} ${fullMock === 1 ? "full mock" : "full mocks"} and ${finalTest} ${finalTest === 1 ? "final test" : "final tests"}.`,
    listeningMediaTitle: "Listening media",
    listeningMediaDetail: (count: number) => `${count} ${count === 1 ? "uploaded audio or browser-narrated transcript" : "uploaded audio or browser-narrated transcripts"}.`,
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
