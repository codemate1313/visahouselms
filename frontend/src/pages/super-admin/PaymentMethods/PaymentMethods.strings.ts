export const paymentMethodsStrings = {
  title: "Payment Methods",
  subtitle: "Modes of payment offered when recording offline payments (Bank Transfer, UPI, Cash, etc.).",
  addForm: {
    heading: "Add Payment Method",
    nameLabel: "Method name",
    namePlaceholder: "e.g. Crypto / UPI",
    adding: "Adding...",
    addMethod: "Add Method",
  },
  searchPlaceholder: "Search method name...",
  exportPdf: "Export PDF",
  exportExcel: "Export Excel",
  resultCount: {
    showing: "Showing",
    entry: "entry",
    entries: "entries",
  },
  loading: "Loading...",
  table: {
    methodName: "Method Name",
    status: "Status",
    actions: "Actions",
    empty: "No payment methods found.",
    deactivate: "Deactivate Method",
    reactivate: "Reactivate Method",
    delete: "Delete Method",
  },
  deleteModal: {
    title: "Delete Payment Method",
    message: (name: string) => `Are you sure you want to delete payment method "${name}"?`,
    confirmText: "Delete Method",
  },
  confirm: {
    toggle: (action: string, name: string) => `Are you sure you want to ${action} payment method "${name}"?`,
    activateTitle: "Activate Payment Method",
    deactivateTitle: "Deactivate Payment Method",
  },
  errors: {
    load: "Failed to load payment methods.",
    create: "Failed to create payment method.",
    toggle: (action: string) => `Failed to ${action} payment method.`,
    delete: "Failed to delete payment method.",
  },
  pdf: {
    header: "Language CERT — Payment Methods",
    columns: ["#", "Payment Method Name", "Status"],
  },
  excel: {
    sheetName: "Payment Methods",
    columns: ["#", "Method Name", "Status"],
  },
} as const;
