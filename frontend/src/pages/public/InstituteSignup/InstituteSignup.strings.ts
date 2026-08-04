export const instituteSignupStrings = {
  eyebrow: "Apply",
  title: "Run your institute on Visa House",
  subtitle:
    "Tell us about your centre and we'll review your application by hand. If it's approved you'll get login details for your institute admin account and can pick a plan from there.",
  interestedIn: (plan: string) => `You were looking at ${plan}. You can change your mind after approval - this is just so we know what you had in mind.`,

  sections: {
    institute: "About your institute",
    admin: "Who will run it",
    context: "Anything else",
  },

  fields: {
    instituteName: "Institute name",
    contactEmail: "Institute contact email",
    contactEmailHint: "Where we send updates about this application.",
    contactPhone: "Phone",
    city: "City",
    country: "Country",
    website: "Website",
    adminFirstName: "First name",
    adminLastName: "Last name",
    adminEmail: "Admin login email",
    adminEmailHint: "This becomes the login for your institute admin account if approved.",
    expectedStudents: "Roughly how many students?",
    message: "Tell us about your centre",
    messagePlaceholder: "How long you've been running, what exams you prepare students for, anything that helps us place you.",
  },

  submit: "Submit application",
  submitting: "Submitting...",

  success: {
    title: "Application received",
    body: (email: string) =>
      `Thanks - we've sent a confirmation to ${email}. We review applications by hand, usually within two working days. If it's approved you'll get a second email with your login details.`,
    back: "Back to plans",
  },

  errors: {
    submit: "We couldn't submit your application. Please try again.",
    required: "Fill in the required fields before submitting.",
  },
} as const;
