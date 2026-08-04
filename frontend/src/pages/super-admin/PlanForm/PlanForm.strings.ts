/** One form, two catalogues. A bespoke institute agreement is still authored on
 *  the institute form and marked internal, so it never reaches this screen. */
export type PlanAudience = "direct_students" | "institutes";

export const directStudentCatalogue = {
  basePath: "/super-admin/plans",
  createTitle: "Create Direct Student Plan",
  editTitle: "Edit Direct Student Plan",
  subtitle: "Bundle published courses for students purchasing access directly from the website.",
  publishLabel: "Publish on website",
  publishHint: "Only published plans are visible to direct students.",
} as const;

export const instituteCatalogue = {
  basePath: "/super-admin/plans",
  createTitle: "Create Institute Tier",
  editTitle: "Edit Institute Tier",
  subtitle:
    "A standard tier institutes can subscribe to and renew themselves. Changes apply to future terms only - anyone already subscribed keeps the price and seats their term was cut with.",
  publishLabel: "Offer to institutes",
  publishHint:
    "Only published tiers appear as renewal options on an institute's billing page and on the public pricing page.",
} as const;

export const planFormCatalogues: Record<PlanAudience, typeof directStudentCatalogue> = {
  direct_students: directStudentCatalogue,
  institutes: instituteCatalogue,
};

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
