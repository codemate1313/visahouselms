export const instituteBrandingStrings = {
  eyebrow: "Branding",
  title: "Make it yours",
  subtitle:
    "Your students and instructors see these colours, this typeface and this logo across their portal. Change them as often as you like.",

  loading: "Loading branding...",

  fields: {
    primary: "Primary colour",
    primaryHint: "Buttons, links and highlights.",
    secondary: "Secondary colour",
    secondaryHint: "Sidebars and supporting surfaces.",
    font: "Typeface",
    headingWeight: "Heading weight",
    bodyWeight: "Body weight",
    logo: "Logo",
    logoHint: "PNG or JPG, up to 2 MB. Square works best.",
    replaceLogo: "Replace logo",
    uploading: "Uploading...",
  },

  fonts: ["Plus Jakarta Sans", "Inter", "Sora", "Outfit", "system-ui"],
  weights: [400, 500, 600, 700, 800],

  preview: {
    heading: "Preview",
    sample: "Your students see this",
    body: "Band scores, mock tests and feedback, in your colours.",
    button: "Primary action",
  },

  save: "Save branding",
  saving: "Saving...",
  saved: "Branding updated.",

  errors: {
    load: "Could not load your branding.",
    save: "Could not save your branding.",
    logo: "Could not upload the logo.",
  },
} as const;
