export const instituteBillingStrings = {
  eyebrow: "Subscription",
  title: "Subscription & Payments",
  subtitle: "Review the access assigned by the Super Admin.",
  noActivePlan: "No active plan",
  validUntil: (date: string) => `- valid until ${date}`,
  stats: {
    students: "Students",
    instructors: "Instructors",
    tests: "Tests",
    unlimited: "Unlimited",
  },
  history: {
    title: "Payment history",
    invoice: "Invoice",
    plan: "Plan",
    amount: "Amount",
    status: "Status",
    date: "Date",
    pendingInvoice: "Pending",
    empty: "No payments yet.",
  },
  errors: {
    load: "Failed to load subscription details.",
  },
} as const;
