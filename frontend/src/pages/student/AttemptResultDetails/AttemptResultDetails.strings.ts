export const attemptResultDetailsStrings = {
  eyebrow: "Detailed review",
  loadError: "Failed to load this detailed review.",
  loading: "Loading...",
  resultOverview: "Result overview",
  allAttempts: "All attempts",
  statusLabels: {
    submitted: "Submitted - auto-grading",
    grading: "Awaiting instructor grading",
    graded: "Graded",
    expired: "Expired before submission",
  },
  stats: {
    attempted: "Attempted",
    correct: "Correct",
    incorrect: "Incorrect",
    unanswered: "Unanswered",
  },
  outcome: {
    unanswered: "Unanswered",
    correct: "Correct",
    incorrect: "Incorrect",
    pendingReview: "Pending review",
  },
  cefr: {
    overallPendingDescriptor: "Your final CEFR profile will be available when every assessed skill has been graded.",
    overallLabel: "Overall",
    pending: "Pending",
    awaitingExaminer: "Awaiting examiner",
    marksSuffix: "marks",
    sourceLink: "Council of Europe framework source",
  },
  partReview: {
    pendingTotal: "Pending",
    tableHeaders: {
      question: "Question",
      yourAnswer: "Your answer",
      correctAnswer: "Correct answer",
      result: "Result",
    },
    examinerComment: "Examiner comment:",
    aiComment: "AI evaluator comment:",
    notGradedYet: "Your instructor has not graded this part yet.",
    aiGradedBadge: "Evaluated by AI",
    aiGradedHint: "This part was automatically evaluated by AI. Request instructor review below if you'd like a human to check it.",
  },
  scoreUpdateHint: "Your final score will update once every part has been graded.",
  reevaluation: {
    resultReviewEyebrow: "Result review",
    requestHeading: "Reevaluation request",
    reviewerPrefix: "Reviewer:",
    resolutionHeading: "Resolution",
    errors: {
      submit: "Failed to submit your reevaluation request.",
    },
  },
  reevaluationForm: {
    eyebrow: "Need another review?",
    heading: "Request instructor review",
    description:
      "Your request stays with your institute staff. It is routed to the Super Admin instructor queue only when your institute has no active staff.",
    reasonLabel: "Reason for review",
    submitting: "Submitting...",
    submit: "Submit instructor review request",
  },
  retake: {
    eyebrow: "Retake request",
    heading: "Retake request",
    reviewerPrefix: "Reviewed by:",
    resolutionHeading: "Admin note",
    errors: {
      submit: "Failed to submit your retake request.",
    },
  },
  retakeForm: {
    eyebrow: "Couldn't complete this test?",
    heading: "Raise a Retake Request",
    description:
      "Each test can only be attempted once. If something went wrong - a technical issue, an interruption, or anything that stopped you from completing it properly - explain what happened and the Super Admin will review your request.",
    reasonLabel: "Reason for the retake request",
    submitting: "Submitting...",
    submit: "Submit retake request",
  },
} as const;
