export const instituteDashboardStrings = {
  welcome: (firstName: string | undefined) => `Welcome, ${firstName}`,
  subtitle: "Your institute workspace and assigned access.",
  stats: {
    students: "Students",
    instructors: "Instructors",
    activeMembers: "Active members",
    subscription: "Subscription",
  },
  subscriptionPanel: {
    heading: "Subscription usage",
    noActivePlan: "No active plan",
    noneAssigned: "No subscription has been assigned.",
    renewsOrExpires: (date: string) => `Renews or expires ${date}.`,
    viewSubscription: "View subscription",
    instructorsLabel: "instructors",
  },
  recentMembersPanel: {
    heading: "Recent members",
    description: "Newest accounts in your institute.",
    empty: "No members have been added yet.",
    student: "Student",
    instructor: "Instructor",
  },
  accessPending: {
    heading: "Access pending",
    description: "Your Super Admin has not assigned institute management permissions yet.",
  },
  errors: {
    load: "Failed to load the institute dashboard.",
  },
} as const;
