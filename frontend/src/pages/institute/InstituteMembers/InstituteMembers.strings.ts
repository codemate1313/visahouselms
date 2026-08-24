export const instituteMembersStrings = {
  loading: "Loading...",
  eyebrow: "People",
  subtitle: "Manage and inspect institute accounts from one place.",
  downloadTemplate: "Download template",
  importCsvExcel: "Import CSV / Excel",
  addStudent: "Add student",
  addInstructor: "Add instructor",
  searchPlaceholder: (label: string) => `Search ${label.toLowerCase()}...`,
  filters: {
    accountType: {
      placeholder: "All account types",
      student: "Students",
      instructor: "Institute instructors",
    },
    status: {
      placeholder: "Any status",
      active: "Active",
      inactive: "Deactivated",
      expired: "Access expired",
      released: "Past students",
      reclaimable: "Seat can be freed",
      deleted: "Deleted",
      passwordResetPending: "Password reset pending",
    },
    activity: {
      placeholder: "Any test activity",
      hasAttempts: "Has test attempts",
      noAttempts: "No test attempts",
    },
    session: {
      placeholder: "Any device/session",
      activeSession: "Currently signed in",
      knownDevices: "Known devices",
      noDevices: "No known devices",
    },
  },
  bulkActions: {
    selectedSuffix: "selected",
    activate: "Activate",
    deactivate: "Deactivate",
    freeSeats: "Free seats",
    delete: "Delete",
    clear: "Clear",
  },

  seats: {
    ariaLabel: "Student seats",
    eyebrow: "Student seats",
    free: (free: number) => (free === 0 ? "None free" : `${free} free`),
    barLabel: (used: number, total: number) => `${used} of ${total} seats in use`,
    subscriptionEnds: (day: string) => `Subscription runs to ${day}`,
    activeCount: (count: number) => `${count} with access`,
    suspendedCount: (count: number) => `${count} deactivated`,
    expiredCount: (count: number) => `${count} expired`,
    reclaimableLink: (count: number) =>
      `${count} ${count === 1 ? "student is" : "students are"} holding a seat without access - free ${count === 1 ? "it" : "them"}`,
    pastStudentsLink: (count: number) =>
      `${count} past ${count === 1 ? "student" : "students"} you can bring back`,
  },

  windowModal: {
    title: (mode: string) => (mode === "reactivate" ? "Bring this student back" : "Change access dates"),
    forStudent: (name: string, email: string) => `${name} (${email})`,
    startsOn: "Access starts",
    endsOn: "Access ends",
    quickPick: "Quick pick:",
    months: (count: number) => `${count} month${count === 1 ? "" : "s"}`,
    length: (days: number) => `${days} day${days === 1 ? "" : "s"} of access`,
    ceiling: (day: string) => `Cannot run past ${day}, when the institute's subscription ends.`,
    orderWrong: "The end date cannot be before the start date.",
    pastSubscription: "That is past the institute's subscription end date.",
    takesASeat: (free: number | null) =>
      free === null
        ? "This takes one of the institute's seats."
        : `This takes one of the institute's seats. ${free} free right now.`,
    noSeatWarning:
      "Every seat is in use. Free a seat from a student whose access has ended before bringing this one back.",
    confirm: (mode: string) => (mode === "reactivate" ? "Reactivate" : "Save dates"),
    saving: "Saving...",
    cancel: "Cancel",
  },
  featureLocked: {
    eyebrow: "Feature locked",
    title: "You do not have this feature",
    description:
      "This institute has 0 instructor slots assigned. Contact the Super Admin to enable instructor management for this institute.",
    contactCta: "Contact Super Admin",
    viewSubscription: "View subscription",
    emailPrefix: "Email:",
  },
  table: {
    name: "Name",
    email: "Email",
    type: "Type",
    tests: "Tests",
    devices: "Devices",
    contact: "Contact",
    status: "Status",
    access: "Access",
    created: "Created",
    actions: "Actions",
    emptyRow: (label: string) => `No ${label.toLowerCase()} found.`,
    passwordResetBadge: "password reset",
    statusActive: "Active",
    statusSuspended: "Deactivated",
    statusExpired: "Expired",
    statusReleased: "Past student",
    statusDeleted: "Deleted",
    statusNotStarted: "Upcoming",
    noSeatHint: "no seat",
    daysLeft: (days: number) =>
      days <= 0 ? "ends today" : `${days} day${days === 1 ? "" : "s"} left`,
    noWindow: "-",
  },
  actionTooltips: {
    view: "View member",
    edit: "Edit member",
    resetPassword: "Reset password",
    deactivate: "Deactivate member",
    reactivate: "Reactivate member",
    changeWindow: "Change access dates",
    freeSeat: "Free seat",
    reactivateSeat: "Reactivate (takes a seat)",
    delete: "Delete member",
  },
  credentialModal: {
    title: "Temporary password",
    shareHint: (name: string) => `Share this with ${name}. It will not be shown again.`,
    passwordLabel: "Password",
    copyPassword: "Copy password",
    done: "Done",
  },
  importModal: {
    title: "Student import",
    summary: (created: number, skipped: number, remaining: number) =>
      `${created} created, ${skipped} skipped, ${remaining} slots remaining.`,
    credentialsHeading: "Credentials",
    downloadCsv: "Download CSV",
    student: "Student",
    email: "Email",
    temporaryPassword: "Temporary password",
    invalidEmailsHeading: "Invalid email accounts were discarded",
    invalidEmailsMessage:
      "These email addresses were invalid or could not receive email. Please check them and try creating the accounts again.",
    skippedRowsHeading: "Skipped rows",
    otherSkippedRowsHeading: "Other skipped rows",
    row: "Row",
    reason: "Reason",
    done: "Done",
  },
  confirm: {
    deleteOne: (email: string) =>
      `Are you sure you want to delete member "${email}"? The account will be signed out while test history is retained.`,
    deleteOneTitle: "Delete Member",
    deleteMany: (count: number) =>
      `Are you sure you want to delete ${count} member${count === 1 ? "" : "s"}? Their accounts will be signed out while test history is retained.`,
    deleteManyTitle: "Delete Members",
    resetPassword: (email: string) => `Are you sure you want to reset the password for ${email}?`,
    resetPasswordTitle: "Reset Member Password",
    resetPasswordConfirm: "Reset Password",
    toggleMember: (action: string, name: string, email: string) => `Are you sure you want to ${action} member "${name}" (${email})?`,
    activateMemberTitle: "Activate Member",
    deactivateMemberTitle: "Deactivate Member",
    toggleMany: (action: string, count: number) => `Are you sure you want to ${action} ${count} selected member${count === 1 ? "" : "s"}?`,
    activateManyTitle: "Activate Members",
    deactivateManyTitle: "Deactivate Members",
    freeSeat: (name: string, email: string) =>
      `Free the seat held by "${name}" (${email})?\n\n` +
      "They keep their records, results and sign-in email, and stay searchable - " +
      "you can bring them back later. But reactivating takes a seat, and you will " +
      "need a free one at the time.",
    freeSeatTitle: "Free This Seat",
    freeSeatConfirm: "Free seat",
    freeSeatMany: (count: number) =>
      `Free ${count} seat${count === 1 ? "" : "s"}?\n\n` +
      "These students keep their records, results and sign-in emails, and stay " +
      "searchable - you can bring them back later. But reactivating takes a seat, " +
      "and you will need free ones at the time.",
    freeSeatManyTitle: "Free Seats",
  },
  errors: {
    load: (label: string) => `Failed to load ${label.toLowerCase()}.`,
    updateStatus: "Failed to update the member status.",
    resetPassword: "Failed to reset the password.",
    delete: "Failed to delete the member.",
    import: "Failed to import students.",
    bulkToggle: (action: string, failed: number, total: number) =>
      `Failed to ${action} ${failed} of ${total}.`,
    bulkDelete: (failed: number, total: number) => `Failed to delete ${failed} of ${total} members.`,
    freeSeat: "Failed to free the seat.",
    bulkFreeSeats: (failed: number, total: number) => `Failed to free ${failed} of ${total} seats.`,
    setWindow: "Failed to save the access dates.",
    reactivateSeat: "Failed to reactivate the student.",
  },
} as const;
