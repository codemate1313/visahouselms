export const instituteSetupStrings = {
  eyebrow: "Welcome",
  title: (institute: string) => `Let's get ${institute} running`,
  subtitle:
    "Your admin account is live. Two things left: make the portal look like yours, and choose the plan you want to run on. Students and staff can be added once your first term is paid for.",

  steps: {
    branding: {
      number: "1",
      title: "Make it yours",
      description: "Your students see these colours and this logo. You can change them any time from your profile.",
      primary: "Primary colour",
      secondary: "Secondary colour",
      logo: "Logo",
      logoHint: "PNG or JPG, up to 2 MB. Square works best.",
      logoButton: "Upload logo",
      uploading: "Uploading...",
      save: "Save branding",
      saving: "Saving...",
      saved: "Branding saved.",
      skip: "You can skip this and come back to it later.",
    },
    plan: {
      number: "2",
      title: "Choose your plan",
      description:
        "Pick the tier that fits your centre. Your term starts the moment payment clears, and the portal opens up straight after.",
      none: "No plans are available to choose from right now. Please contact support.",
    },
  },

  errors: {
    branding: "Could not save branding.",
    logo: "Could not upload the logo.",
  },
} as const;
