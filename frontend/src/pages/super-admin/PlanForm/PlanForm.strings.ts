/** Per-catalogue wording and field set. The catalogues are independent, so a
 *  plan authored here can only ever be sold through its own channel. */
export const planFormCatalogues = {
  direct_students: {
    basePath: "/super-admin/plans",
    createTitle: "Create Direct Student Plan",
    editTitle: "Edit Direct Student Plan",
    subtitle: "Bundle published courses for students purchasing access directly from the website.",
    showSeatLimits: false,
    showPublishToggle: true,
    publishLabel: "Publish on website",
    publishHint: "Only published plans are visible to direct students.",
  },
  institutes: {
    basePath: "/super-admin/institute-plans",
    createTitle: "Create Institute Plan",
    editTitle: "Edit Institute Plan",
    subtitle: "Seats, tests and courses granted to an institute through an access agreement.",
    showSeatLimits: true,
    showPublishToggle: false,
    publishLabel: "",
    publishHint:
      "Institute plans are never listed on the public pricing page — assign this plan to an institute from Access Agreements.",
  },
} as const;

export type PlanAudience = keyof typeof planFormCatalogues;

export const planFormStrings = {
  loading: "Loading...",
  fields: {
    name: "Plan name",
    description: "Description",
    price: "Price",
    currency: "Currency",
    durationDays: "Access duration (days)",
    testLimit: "Test attempt limit",
    studentLimit: "Student seats",
    staffLimit: "Instructor seats",
    graceDays: "Grace period (days)",
  },
  coursePicker: {
    legend: "Included courses",
    hint: "Add or remove courses at any time. Hidden courses remain configured but are unavailable to students.",
    selectAll: "Select all",
    empty: "No published courses are available.",
    defaultAuthor: "SA Instructor",
    hiddenSuffix: " · hidden",
  },
  featureEditor: {
    legend: "Pricing card features",
    hint: "These bullets appear, ticked, on the public pricing card. Leave empty to fall back to an automatic list built from the plan's courses and limits.",
    empty: "No features added — the pricing card will use the automatic list.",
    placeholder: "e.g. AI writing & speaking feedback",
    itemLabel: (position: number) => `Feature ${position}`,
    add: "+ Add feature",
    remove: "Remove feature",
    removeGlyph: "x",
  },
  saving: "Saving...",
  savePlan: "Save plan",
  cancel: "Cancel",
  errors: {
    load: "Failed to load plan.",
    save: "Failed to save plan.",
  },
} as const;
