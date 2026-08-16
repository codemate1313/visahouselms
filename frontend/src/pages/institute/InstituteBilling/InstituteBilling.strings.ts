export const instituteBillingStrings = {
  terms: {
    ariaLabel: "Subscription terms",
    heading: (count: number) => `${count} plans running — their time adds up`,
    range: (from: string, to: string) => ` ${from} → ${to} `,
    combined: (until: string) => `Combined access runs to ${until}.`,
    stepDown: (before: number, after: number, on: string) =>
      `Student seats drop from ${before} to ${after} on ${on}, when your earlier term ends.`,
  },

  eyebrow: "Subscription",
  title: "Subscription & Payments",
  subtitle: "Review the access assigned by the Super Admin.",
  noActivePlan: "No active plan",
  validUntil: (date: string) => `- valid until ${date}`,
  stats: {
    students: "Students",
    instructors: "Instructors",
    testsTaken: "Tests taken",
    testsUnmetered: "No cap - students may sit every test assigned to them",
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
  renew: {
    eyebrow: "Renew",
    title: "Renew or change your plan",
    activationTitle: "Choose your plan",
    description:
      "Buy your next term. Pick the plan you are already on to renew it unchanged, or move to another tier - either way the new term starts when your current one ends.",
    activationEyebrow: "Get started",
    activationDescription:
      "Pick the tier that fits your centre. Your term starts as soon as payment clears and the portal opens up straight after.",
    yourPlansHeading: "Plans you have held",
    catalogueHeading: "Other tiers",
    availableHeading: "Available plans",
    currentBadge: "Current plan",
    heldBadge: "Held before",
    unavailableBadge: "No longer offered",
    seats: (students: number, staff: number) =>
      staff === 0
        ? `${students} students · no instructor seats`
        : `${students} students · ${staff} instructors`,
    perTerm: (days: number) => `per ${days} days`,
    free: "No charge",
    selected: "Selected",
    select: "Select",
    planLabel: "Plan",
    amountLabel: "Amount payable",
    amountLabelFree: "Cost",
    freeAmount: "No charge",
    freeNotice:
      "This plan carries no charge, so renewing simply extends your term - there is nothing to pay.",
    extend: "Extend term",
    extending: "Extending term...",
    termLabel: "New term",
    termValue: (start: string, end: string) => `${start} → ${end}`,
    termNote: (days: number) =>
      `${days} days added on top of your current expiry, so no time is lost by renewing early.`,
    activationTermNote: (days: number) => `${days} days of access, starting the moment payment clears.`,
    basePrice: "Base price",
    gst: (percentage: number, type: string) => `GST (${percentage}% ${type})`,
    total: "Total payable",
    couponLabel: "Discount code (optional)",
    couponPlaceholder: "ENTER CODE",
    pay: (amount: string) => `Pay ${amount} & renew`,
    payManual: "Record renewal",
    // Nothing is being renewed on a first purchase - there is no prior term.
    payActivation: (amount: string) => `Pay ${amount} & activate`,
    payManualActivation: "Activate subscription",
    paying: "Opening payment...",
    verifying: "Confirming payment...",
    offlineNotice:
      "Online payment is not configured yet. Continuing here books the term immediately and records the invoice for reconciliation.",
    gatewayNotice: "Secure checkout via Razorpay - UPI, cards and net banking.",
    success: (plan: string) => `${plan} renewed. Your new term is active.`,
    successTitle: "Subscription renewed",
    activationSuccess: (plan: string) => `${plan} is active. Your portal is ready.`,
    activationSuccessTitle: "Subscription active",
    switchNotice: (plan: string) =>
      `You are moving to ${plan}. Your current term runs to its end date first - nothing is cut short.`,
    blocked:
      "The Razorpay payment window could not be opened. Open this page in a regular (non-Incognito) window, disable ad-blockers, and try again.",
  },
  errors: {
    load: "Failed to load subscription details.",
    renew: "Payment failed. Nothing was charged.",
    verify: "Payment verification failed. If money was deducted, contact support with your order ID.",
  },
} as const;
