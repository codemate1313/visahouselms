export const institutesStrings = {
  searchPlaceholder: "Search name, slug, or email...",
  exportPdf: "Export PDF",
  exportExcel: "Export Excel",
  onboardInstitute: "Onboard Institute",
  resultCount: {
    showing: "Showing",
    entry: "entry",
    entries: "entries",
  },
  loading: "Loading...",
  table: {
    institute: "Institute",
    contactAndSlug: "Contact & Slug",
    subscription: "Subscription",
    status: "Status",
    actions: "Actions",
    empty: "No institutes found matching your query.",
    idPrefix: "ID: #",
    slugPrefix: "slug:",
    suspendInstitute: "Suspend Institute",
    reactivateInstitute: "Reactivate Institute",
    editInstitute: "Edit Institute",
    manageStudents: "Manage Students",
    branding: "Institute Branding",
    delete: "Delete Institute",
  },
  deleteModal: {
    title: "Permanently Delete Institute",
    message: (name: string) =>
      `Delete "${name}" and all of its users, learning activity, settings, branding, and assignments? Financial records will be retained for accounting. This action cannot be undone.`,
    confirmText: "Delete Permanently",
  },
  errors: {
    load: "Failed to load institutes.",
    toggle: (action: string) => `Failed to ${action} institute.`,
    delete: "Failed to delete institute.",
  },
  confirm: {
    toggle: (action: string, name: string) => `Are you sure you want to ${action} institute "${name}"?`,
    suspendTitle: "Suspend Institute",
    reactivateTitle: "Reactivate Institute",
  },
  pdf: {
    header: "IELTS LMS — Institutes Report",
    generatedPrefix: "Generated:",
    columns: ["#", "Institute", "Slug", "Contact Email", "Subscription", "Status", "Onboarding"],
  },
  excel: {
    sheetName: "Institutes",
    columns: ["#", "Institute Name", "Slug", "Contact Email", "Subscription", "Status", "Onboarding", "Created At"],
  },
} as const;
