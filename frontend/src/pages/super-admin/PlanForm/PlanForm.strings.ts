/** Wording for the only catalogue there is. An institute's plan belongs to its
 *  own access agreement and is authored on the institute form, never here. */
export const directStudentCatalogue = {
  basePath: "/super-admin/plans",
  createTitle: "Create Direct Student Plan",
  editTitle: "Edit Direct Student Plan",
  subtitle: "Bundle published courses for students purchasing access directly from the website.",
  publishLabel: "Publish on website",
  publishHint: "Only published plans are visible to direct students.",
} as const;

export const planFormStrings = {
  loading: "Loading...",
  fields: {
    name: "Plan name",
    description: "Description",
    price: "Price",
    currency: "Currency",
    durationDays: "Access duration (days)",
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
    hint: "These bullet features appear, ticked, on the pricing card for students.",
    empty: "No features added yet. Add at least one feature bullet.",
    placeholder: "e.g. AI writing & speaking feedback",
    itemLabel: (position: number) => `Feature ${position}`,
    add: "Add feature",
    remove: "Remove feature",
    removeGlyph: "x",
  },
  saving: "Saving...",
  savePlan: "Save plan",
  cancel: "Cancel",
  errors: {
    load: "Failed to load plan.",
    save: "Failed to save plan.",
    featuresRequired: "Add at least one pricing card feature before saving this plan.",
  },
} as const;
