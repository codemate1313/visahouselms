export const gradingQueueStrings = {
  title: "Grading Queue",
  subtitle: {
    instituteInstructor: "Writing and Speaking submissions from students in your institute.",
    saInstructor: "Direct-student submissions and institute submissions without an active institute instructor.",
  },
  loading: "Loading...",
  errors: {
    load: "Failed to load the grading queue.",
  },
  stats: {
    pending: "Awaiting grading",
    claimed: "Claimed",
    reevaluations: "Reevaluations",
  },
  statusFilter: {
    ariaLabel: "Status",
    all: "All",
    unclaimed: "Unclaimed",
    claimed: "Claimed",
    completed: "Completed",
  },
  empty: {
    title: "No submissions waiting",
    description: "Submissions for your Writing and Speaking modules will appear here once students submit.",
  },
  table: {
    student: "Student",
    course: "Course",
    queue: "Queue",
    owner: "Owner",
    due: "Due",
    flags: "Flags",
    partsLeft: "Parts left",
    actions: "Actions",
    unclaimed: "Unclaimed",
    reevaluationBadge: "Reevaluation",
    gradeSubmission: "Grade submission",
    evaluating: "In evaluation",
    anotherInstructor: "another instructor",
    evaluatingBy: (name: string) => `${name} is evaluating this submission`,
  },
} as const;
