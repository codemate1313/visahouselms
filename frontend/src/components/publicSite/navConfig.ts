import type { IconName } from "@/components/icons";

export interface PublicNavItem {
  label: string;
  href: string;
}

/** Shared by the desktop nav and the mobile drawer. */
export const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/plans" },
  { label: "Blogs", href: "/blogs" },
  { label: "Contact", href: "/contact" },
];

export interface PublicFooterLink {
  label: string;
  url: string;
}

export interface PublicFooterColumn {
  title: string;
  links: PublicFooterLink[];
}

/**
 * The original DC pages pointed "Showcase" links at the raw `/dc-pages/*.dc.html`
 * export paths (an artifact of the export tool, not a real route) — corrected
 * here to the actual app routes.
 */
export const PUBLIC_FOOTER_COLUMNS: PublicFooterColumn[] = [
  {
    title: "Showcase",
    links: [
      { label: "Platform Home", url: "/" },
      { label: "About Us", url: "/about" },
      { label: "Pricing", url: "/plans" },
      { label: "Contact Support", url: "/contact" },
    ],
  },
  {
    title: "Access Portals",
    links: [
      { label: "Student Portal", url: "/login?role=STUDENT" },
      { label: "Institute Portal", url: "/login?role=INSTITUTE_ADMIN" },
      { label: "Instructor Portal", url: "/login?role=INST_INSTRUCTOR" },
    ],
  },
  {
    title: "Partnerships",
    links: [
      { label: "Request for Institute", url: "/institute-signup" },
      { label: "For Institutes", url: "/" },
      { label: "Resources", url: "/blogs" },
    ],
  },
];

export const SOCIAL_ICON_NAMES: Record<string, IconName> = {
  linkedin: "socialLinkedin",
  github: "socialGithub",
  instagram: "socialInstagram",
  youtube: "socialYoutube",
  facebook: "socialFacebook",
  twitter: "socialTwitter",
  tiktok: "socialTiktok",
  website: "socialWebsite",
};

export const SOCIAL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  instagram: "Instagram",
  youtube: "Youtube",
  facebook: "Facebook",
  twitter: "X (Twitter)",
  tiktok: "TikTok",
  website: "Website",
};
