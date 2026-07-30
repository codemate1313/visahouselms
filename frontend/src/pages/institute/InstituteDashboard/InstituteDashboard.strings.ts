export const instituteDashboardStrings = {
  loading: "Loading...",
  welcome: (firstName: string | undefined) => `Welcome, ${firstName}`,
  subtitle: "Your institute workspace and assigned access.",
  stats: {
    students: "Students",
    instructors: "Instructors",
    activeMembers: "Active members",
    subscription: "Subscription",
  },
  accessCountdown: {
    activeLabel: "Subscription time left",
    graceLabel: "Grace period - time left",
    endedLabel: "Subscription expired",
    endedValue: "Access ended",
    plan: (name: string | null) => (name ? `${name} plan` : "No plan assigned"),
    endsOn: (date: string) => `Access ends ${date}`,
    endedOn: (date: string) => `Access ended ${date}`,
    graceNote: (days: number) => `Includes ${days} grace ${days === 1 ? "day" : "days"} after the plan end date.`,
    warning:
      "When this deadline passes, every account under your institute - all students, all instructors and this admin account - is disabled automatically until the plan is renewed.",
    endedWarning:
      "All student, instructor and admin accounts under your institute are disabled. Renewing the plan restores access.",
    renew: "Renew subscription",
    timeLeft: (days: number, hours: number, minutes: number) =>
      days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
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
