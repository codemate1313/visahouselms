export const instituteSignupsStrings = {
  loading: "Loading applications...",
  empty: "No applications here.",

  tabs: [
    { value: "pending" as const, label: "Pending" },
    { value: "approved" as const, label: "Approved" },
    { value: "rejected" as const, label: "Rejected" },
  ],

  fields: {
    submitted: "Submitted",
    contact: "Contact",
    admin: "Admin account",
    location: "Location",
    website: "Website",
    expected: "Expected students",
    expectedInstructors: "Expected instructors",
    interested: "Interested in",
    message: "What they told us",
    reviewedBy: "Reviewed by",
    reason: "Reason given",
    none: "—",
  },

  approve: "Approve & create account",
  approving: "Creating account...",
  reject: "Reject",
  rejecting: "Rejecting...",
  viewInstitute: "Open institute",

  approvedTitle: "Institute created",
  approvedBody: (email: string) =>
    `Login details have been emailed to ${email}. They'll be asked to change the password on first sign-in, then pick a plan and pay before the portal opens up.`,
  tempPasswordLabel: "Temporary password (shown once)",
  tempPasswordHint: "Only relay this if the email doesn't arrive.",

  rejectModal: {
    title: "Reject this application",
    body: "Your reason is emailed to the applicant word for word and kept on the record, so write it as though they'll read it — because they will.",
    label: "Reason",
    placeholder: "e.g. We couldn't verify the institute's registration details.",
    confirm: "Reject and notify",
  },

  errors: {
    load: "Failed to load applications.",
    approve: "Could not approve this application.",
    reject: "Could not reject this application.",
  },
} as const;
