/**
 * Two catalogues, one screen. Direct-student plans are sold from the public
 * pricing page; institute tiers are the standard ladder an institute can renew
 * onto itself from its billing page.
 *
 * Bespoke institute agreements are still authored on the institute form and are
 * marked internal, which keeps them out of this catalogue - editing a tier here
 * must never rewrite somebody's negotiated deal.
 */
export type PlanAudience = "direct_students" | "institutes";

export const directStudentCatalogue = {
  basePath: "/super-admin/plans",
  newPlan: "New Plan",
  exportLabel: "direct student plans",
  empty: "No direct-student plans yet.",
  audienceLabel: "direct students",
  visibilityHint: "Direct student plans are listed on the public pricing page.",
  hiddenHint: "Direct student plans are hidden from the public pricing page.",
} as const;

export const instituteCatalogue = {
  basePath: "/super-admin/plans",
  newPlan: "New Tier",
  exportLabel: "institute plans",
  empty: "No institute plans yet",
  audienceLabel: "institutes",
  visibilityHint: "Institute plans are listed on the public pricing page.",
  hiddenHint: "Institute plans are hidden from the public pricing page.",
} as const;

export interface PlanCatalogueStrings {
  basePath: string;
  newPlan: string;
  exportLabel: string;
  empty: string;
  audienceLabel: string;
  visibilityHint: string;
  hiddenHint: string;
}

export const planCatalogues: Record<PlanAudience, PlanCatalogueStrings> = {
  direct_students: directStudentCatalogue,
  institutes: instituteCatalogue,
};

export const planAudienceTabs = [
  { value: "direct_students" as const, label: "Direct students" },
  { value: "institutes" as const, label: "Institutes" },
];

export const plansStrings = {
  editingNote:
    "Editing a tier applies to future terms only - institutes already subscribed keep the price and seats their term was cut with.",
  searchPlaceholder: "Search plan name or description...",
  visibility: {
    label: "Show on website",
    tooltip: "List this catalogue on the public pricing page",
    hiddenNote:
      "Hidden — the public pricing page invites visitors to contact the team instead.",
  },
  exportPdf: "Export PDF",
  exportExcel: "Export Excel",
  newPlan: "New Plan",
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
    header: "Language CERT — Subscription Plans Report",
    generatedPrefix: "Generated:",
    columns: ["#", "Plan Name", "Price", "Duration", "Limits (Students/Staff/Tests)", "Grace", "Courses", "Subs", "Status"],
  },
  excel: {
    sheetName: "Subscription Plans",
    columns: ["#", "Plan Name", "Description", "Price", "Currency", "Duration (Days)", "Student Limit", "Staff Limit", "Test Limit", "Grace Days", "Courses Count", "Active Subscriptions", "Status"],
  },
} as const;
