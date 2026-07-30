export const instituteMemberFormStrings = {
  loading: "Loading...",
  addTitle: (label: string) => `Add ${label}`,
  editTitle: (label: string) => `Edit ${label}`,
  createdTitle: (isStudent: boolean) => `${isStudent ? "Student" : "Instructor"} created`,
  fields: {
    firstName: "First name",
    lastName: "Last name",
    email: "Email",
    phoneNumber: "Phone number",
    address: "Address",
  },
  actions: {
    save: (label: string) => `Save ${label}`,
    saving: "Saving...",
    cancel: "Cancel",
    back: "Back",
    copyPassword: "Copy password",
    done: "Done",
  },
  credential: {
    shareHint: "Share this temporary password now. The member must change it after signing in.",
    emailLabel: "Email",
    passwordLabel: "Password",
  },
  featureLocked: {
    eyebrow: "Feature locked",
    noSlotsTitle: "You do not have this feature",
    capacityReachedTitle: (isStudent: boolean) => `${isStudent ? "Student" : "Instructor"} capacity reached`,
    noSlotsDescription: (isStudent: boolean) =>
      `This institute has 0 ${isStudent ? "student" : "instructor"} slots assigned. Contact the Super Admin to enable this feature.`,
    capacityReachedDescription: (isStudent: boolean) =>
      `This institute cannot add more ${isStudent ? "students" : "instructors"} right now.`,
    contactCta: "Contact Super Admin",
    emailPrefix: "Email:",
  },
  errors: {
    loadCapacity: "Failed to load institute capacity.",
    load: (label: string) => `Failed to load the ${label}.`,
    save: (label: string) => `Failed to save the ${label}.`,
  },
} as const;
