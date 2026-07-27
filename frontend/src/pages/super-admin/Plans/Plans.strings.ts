/**
 * The two plan catalogues are independent: a direct-student plan is sold on the
 * public pricing page and can never be assigned to an institute, an institute
 * plan is granted through an access agreement and is never listed publicly.
 * Everything that differs between the two listings lives here.
 */
export const planCatalogues = {
  direct_students: {
    basePath: "/super-admin/plans",
    tab: "Direct Student Plans",
    newPlan: "+ New Plan",
    exportLabel: "direct student plans",
    empty: "No direct-student plans yet.",
    audienceLabel: "direct students",
    visibilityHint: "Direct student plans are listed on the public pricing page.",
    hiddenHint: "Direct student plans are hidden from the public pricing page.",
  },
  institutes: {
    basePath: "/super-admin/institute-plans",
    tab: "Institute Plans",
    newPlan: "+ New Institute Plan",
    exportLabel: "institute plans",
    empty: "No institute plans yet. Create one to assign it through an access agreement.",
    audienceLabel: "institutes",
    visibilityHint: "Institute plans are listed on the public pricing page.",
    hiddenHint: "Institute plans are hidden from the public pricing page.",
  },
} as const;

export type PlanAudience = keyof typeof planCatalogues;

/** Tab order for the audience switch; also the order used to place its thumb. */
export const planAudienceOrder: PlanAudience[] = ["direct_students", "institutes"];

export const plansStrings = {
  searchPlaceholder: "Search plan name or description...",
  visibility: {
    label: "Show on website",
    tooltip: "List this catalogue on the public pricing page",
    bothHiddenNote:
      "Both catalogues are hidden — the public pricing page invites visitors to contact the team instead.",
  },
  statusFilter: {
    allStatuses: "All statuses",
    active: "Active",
    draft: "Draft",
    inactive: "Inactive",
  },
  exportPdf: "Export PDF",
  exportExcel: "Export Excel",
  newPlan: "+ New Plan",
  resultCount: {
    showing: "Showing",
    entry: "entry",
    entries: "entries",
  },
  loading: "Loading...",
  table: {
    planName: "Plan Name",
    priceAndDuration: "Price & Duration",
    limits: "Limits (std / stf / tst)",
    status: "Status",
    actions: "Actions",
    empty: "No subscription plans found.",
    target: "Target:",
    daysSuffix: "days",
    deactivate: "Deactivate Plan",
    reactivate: "Reactivate Plan",
    viewDetails: "View Full Plan Details",
    edit: "Edit Plan",
    delete: "Delete Plan",
  },
  detailsModal: {
    billingCycleSuffix: "Days Billing Cycle",
    overviewLabel: "Plan Overview & Description",
    studentLimit: "Student Limit",
    studentsSuffix: "Students",
    staffLimit: "Staff Limit",
    staffSuffix: "Staff Members",
    testLimit: "Test Limit",
    testsSuffix: "Mock Tests",
    gracePeriod: "Grace Period",
    graceSuffix: "Days Extension",
    assignedCourses: "Assigned Courses",
    coursesSuffix: "Included Courses",
    activeSubscriptions: "Active Subscriptions",
    subscribersSuffix: "Active Subscribers",
    targetAudience: "Target Audience:",
    publishStatus: "Publish Status:",
    published: "Published",
    draft: "Draft",
    close: "Close",
    editPlan: "Edit Plan",
    closeModalTitle: "Close Modal",
  },
  deleteModal: {
    title: "Delete Plan",
    message: (name: string) => `Are you sure you want to delete plan "${name}"? This action cannot be undone.`,
    confirmText: "Delete Plan",
  },
  errors: {
    load: "Failed to load plans.",
    visibility: "Failed to update website visibility.",
    toggle: (action: string) => `Failed to ${action} plan.`,
    delete: "Failed to delete plan.",
  },
  confirm: {
    toggle: (action: string, name: string) => `Are you sure you want to ${action} plan "${name}"?`,
    activateTitle: "Activate Plan",
    deactivateTitle: "Deactivate Plan",
  },
  pdf: {
    header: "IELTS LMS — Subscription Plans Report",
    generatedPrefix: "Generated:",
    columns: ["#", "Plan Name", "Price", "Duration", "Limits (Students/Staff/Tests)", "Grace", "Courses", "Subs", "Status"],
  },
  excel: {
    sheetName: "Subscription Plans",
    columns: ["#", "Plan Name", "Description", "Price", "Currency", "Duration (Days)", "Student Limit", "Staff Limit", "Test Limit", "Grace Days", "Courses Count", "Active Subscriptions", "Status"],
  },
} as const;
