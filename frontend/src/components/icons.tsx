import type { CSSProperties, ReactNode } from "react";

export type IconName =
  | "plus"
  | "minus"
  | "check"
  | "cross"
  | "play"
  | "pause"
  | "arrowRight"
  | "arrowUp"
  | "arrowDown"
  | "pin"
  | "dashboard"
  | "admin"
  | "instructors"
  | "courses"
  | "user"
  | "session"
  | "lock"
  | "building"
  | "plan"
  | "subscription"
  | "trial"
  | "demo"
  | "coupon"
  | "payment"
  | "wallet"
  | "revenue"
  | "settings"
  | "logs"
  | "terminal"
  | "due"
  | "transactions"
  | "module"
  | "grading"
  | "bucket"
  | "analytics"
  | "products"
  | "billings"
  | "notifications"
  | "search"
  | "help"
  | "logout"
  | "edit"
  | "trash"
  | "revoke"
  | "download"
  | "filePdf"
  | "spreadsheet"
  | "restore"
  | "x"
  | "chevronDown"
  | "moreVertical"
  | "overview"
  | "projects"
  | "toggleOn"
  | "toggleOff"
  | "arrowLeft"
  | "eye"
  | "history"
  | "printer"
  | "microphone"
  | "image"
  | "socialLinkedin"
  | "socialGithub"
  | "socialInstagram"
  | "socialYoutube"
  | "socialFacebook"
  | "socialTwitter"
  | "socialTiktok"
  | "socialWebsite"
  | "globe";

const ICON_PATHS: Record<IconName, ReactNode> = {
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </>
  ),
  microphone: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
      <path d="M9 21h6" />
    </>
  ),
  play: <polygon points="6 4 20 12 6 20 6 4" />,
  pause: (
    <>
      <line x1="9" y1="4" x2="9" y2="20" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </>
  ),
  arrowLeft: (
    <>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </>
  ),
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  toggleOn: (
    <g style={{ fill: "inherit" }}>
      <rect x="2" y="6" width="20" height="12" rx="6" fill="#16a34a" stroke="none" />
      <circle cx="16" cy="12" r="4" fill="#ffffff" stroke="none" />
    </g>
  ),
  toggleOff: (
    <g style={{ fill: "inherit" }}>
      <rect x="2" y="6" width="20" height="12" rx="6" fill="#94a3b8" stroke="none" />
      <circle cx="8" cy="12" r="4" fill="#ffffff" stroke="none" />
    </g>
  ),
  // Solid brand logos for the social-links editor; also used directly by
  // `components/publicSite/PublicFooter.tsx` so the admin picker and the
  // public footer render the same glyph.
  socialLinkedin: (
    <path
      fill="currentColor"
      stroke="none"
      d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"
    />
  ),
  socialGithub: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
    />
  ),
  socialInstagram: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
    />
  ),
  socialYoutube: (
    <path
      fill="currentColor"
      stroke="none"
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.085 0 12 0 12s0 3.915.501 5.814a3.016 3.016 0 0 0 2.122 2.136c1.872.55 9.377.55 9.377.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.915 24 12 24 12s0-3.915-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
    />
  ),
  socialFacebook: (
    <path
      fill="currentColor"
      stroke="none"
      d="M22 12.061c0-5.564-4.477-10.077-10-10.077s-10 4.513-10 10.077c0 5.03 3.657 9.196 8.438 9.955v-7.043h-2.54v-2.912h2.54V9.845c0-2.526 1.492-3.922 3.777-3.922 1.094 0 2.238.197 2.238.197v2.475h-1.26c-1.243 0-1.63.775-1.63 1.57v1.885h2.774l-.443 2.912h-2.331v7.043c4.781-.759 8.437-4.925 8.437-9.955z"
    />
  ),
  socialTwitter: (
    <path
      fill="currentColor"
      stroke="none"
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    />
  ),
  socialTiktok: (
    <path
      fill="currentColor"
      stroke="none"
      d="M16.6 5.82c-1.01-.87-1.6-2.13-1.6-3.52h-3.24v13.7c0 1.65-1.34 3-3 3s-3-1.35-3-3 1.34-3 3-3c.31 0 .61.05.9.13V9.9a6.24 6.24 0 0 0-.9-.07c-3.44 0-6.24 2.8-6.24 6.24S8.06 22.31 11.5 22.31s6.24-2.8 6.24-6.24V9.01a9.2 9.2 0 0 0 5.36 1.72V7.49c-1.79 0-3.42-.63-4.7-1.67z"
    />
  ),
  socialWebsite: (
    <path
      fill="currentColor"
      stroke="none"
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm7.94 9h-3.05c-.1-2.11-.65-4.08-1.55-5.7A8.03 8.03 0 0 1 19.94 11zM12 4c.83 1.02 1.8 3.13 1.94 7H10.06C10.2 7.13 11.17 5.02 12 4zM4.06 11a8.03 8.03 0 0 1 4.6-4.7C7.76 7.92 7.21 9.89 7.11 11H4.06zm0 2h3.05c.1 2.11.65 4.08 1.55 5.7A8.03 8.03 0 0 1 4.06 13zM12 20c-.83-1.02-1.8-3.13-1.94-7h3.88C13.8 16.87 12.83 18.98 12 20zm2.45-1.3c.9-1.62 1.45-3.59 1.55-5.7h3.05a8.03 8.03 0 0 1-4.6 4.7z"
    />
  ),
  // Bucket / Logo Icon from Hugeicons reference
  bucket: (
    <>
      <path d="M5 9h14l-1.5 9.5a2.5 2.5 0 0 1-2.5 2.1H9a2.5 2.5 0 0 1-2.5-2.1L5 9z" />
      <path d="M8.5 9a3.5 3.5 0 0 1 7 0" />
    </>
  ),
  // Modern Hugeicons style Dashboard (Home shape with outline)
  dashboard: (
    <>
      <path d="M4 10.5L12 4l8 6.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8.5z" />
      <path d="M9.5 21v-6a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v6" />
    </>
  ),
  // Analytics Icon (Stock chart rising in a rounded box or trend line)
  analytics: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M7 15l3.5-4.5 3 3L17 8.5" />
      <path d="M14 8.5h3v3" />
    </>
  ),
  // Overview Icon (Grid / Layout outline)
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  // Projects Icon (Folder / File stack outline)
  projects: (
    <>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M9 13h6" />
    </>
  ),
  // Products Icon (Cube / 3D box outline)
  products: (
    <>
      <path d="M21 8L12 3 3 8l9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v10" />
    </>
  ),
  // User / Accounts Icon
  user: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
      <circle cx="18.5" cy="7.5" r="1.5" />
    </>
  ),
  // Transactions Icon (Two opposite directional arrows with folder/list)
  transactions: (
    <>
      <path d="M4 17h12M13 14l3 3-3 3" />
      <path d="M20 7H8M11 4L8 7l3 3" />
    </>
  ),
  // Settings Icon (Minimalist 8-tooth gear)
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  // Billings / Receipt Icon
  billings: (
    <>
      <path d="M6 3h12a2 2 0 0 1 2 2v16l-3-2-3 2-3-2-3 2-3-2V5a2 2 0 0 1 2-2z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  // Notifications Icon (Bell with optional dot)
  notifications: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <circle cx="18" cy="5" r="2" fill="var(--red-500)" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.5-4.5" />
    </>
  ),
  // Pin Icon (pushpin, used by the pinnable notification list)
  pin: (
    <>
      <path d="M12 17v5" />
      <path d="M9 10.8V4h6v6.8a2 2 0 0 0 .6 1.4l1.9 1.9a1 1 0 0 1-.7 1.7H6.2a1 1 0 0 1-.7-1.7l1.9-1.9a2 2 0 0 0 .6-1.4z" />
    </>
  ),
  // Help Center Icon (Question circle)
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" strokeWidth="2.5" />
    </>
  ),
  // Logout Icon (Door exit with right arrow)
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M13.5 7.5l3 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  revoke: (
    <>
      <path d="M4 7v6a7 7 0 0 0 11.95 4.95L20 13.9" />
      <path d="M20 18v-4.1h-4.1" />
      <path d="M20 7V4h-3" />
      <path d="M4 4l16 16" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  filePdf: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </>
  ),
  spreadsheet: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </>
  ),
  restore: (
    <>
      <path d="M4 7v5a8 8 0 1 0 2.34-5.66L4 8.7" />
      <path d="M4 4v4.7h4.7" />
      <path d="M12 8v5l3 2" />
    </>
  ),
  x: (
    <>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </>
  ),
  // Chevron Down Icon
  chevronDown: <path d="M6 9l6 6 6-6" />,
  moreVertical: (
    <>
      <circle cx="12" cy="5" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),

  // Existing icons maintained with high visual quality
  admin: (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  instructors: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M17 8h4M19 6v4M17 14h4" />
    </>
  ),
  courses: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M9 7h7M9 11h5" />
    </>
  ),
  session: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  building: (
    <>
      <path d="M4 21V7.5L12 3l8 4.5V21" />
      <path d="M9 21v-7h6v7" />
      <path d="M8 9h.01M12 9h.01M16 9h.01M8 12h.01M16 12h.01" />
    </>
  ),
  plan: (
    <>
      <rect x="6" y="4" width="12" height="16" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 11h6M9 15h6" />
    </>
  ),
  subscription: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M7 9h10M7 13h5" />
      <path d="M16 14.5l1.3 1.3L20 13" />
    </>
  ),
  trial: (
    <>
      <path d="M6 3h12M6 21h12" />
      <path d="M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />
    </>
  ),
  demo: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M9 20h6" />
      <path d="M12 16v4" />
      <path d="M10 9l4 2-4 2V9z" />
    </>
  ),
  coupon: (
    <>
      <path d="M10 3H5a2 2 0 0 0-2 2v5c0 .5.2 1 .6 1.4l9 9c.8.8 2 .8 2.8 0l5-5c.8-.8.8-2 0-2.8l-9-9C11 3.2 10.5 3 10 3z" />
      <circle cx="7.5" cy="7.5" r="1.3" />
    </>
  ),
  payment: (
    <>
      <path d="M7 7h13l-3-3" />
      <path d="M17 17H4l3 3" />
      <path d="M20 7l-3 3" />
      <path d="M4 17l3-3" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16" cy="14" r="1.2" />
    </>
  ),
  revenue: (
    <>
      <path d="M6 4h12" />
      <path d="M6 8h12" />
      <path d="M9 4c4.2 0 6.4 2.1 6.4 5.1S13 15 8 15l7 5" />
      <path d="M6 15h9" />
    </>
  ),
  logs: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M9 11h6M9 15h6M9 7h3" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9l3 3-3 3M13 15h4" />
    </>
  ),
  due: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
      <path d="M5 5l2 2M19 5l-2 2" />
    </>
  ),
  module: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),
  grading: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9 13l2 2 4-4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  minus: (
    <>
      <path d="M5 12h14" />
    </>
  ),
  check: (
    <>
      <polyline points="20 6 9 17 4 12" />
    </>
  ),
  cross: (
    <>
      <path d="M18 6L6 18M6 6l12 12" />
    </>
  ),
  arrowRight: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  arrowUp: (
    <>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </>
  ),
  arrowDown: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  printer: (
    <>
      <path d="M7 8V4h10v4" />
      <path d="M7 17H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7z" />
      <path d="M17 12h.01" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </>
  ),
};

const FILL_ONLY_ICONS = new Set<IconName>([
  "toggleOn",
  "toggleOff",
  "socialLinkedin",
  "socialGithub",
  "socialInstagram",
  "socialYoutube",
  "socialFacebook",
  "socialTwitter",
  "socialTiktok",
  "socialWebsite",
]);

export function Icon({ name, className, style }: { name: IconName; className?: string; style?: CSSProperties }) {
  const isFillIcon = FILL_ONLY_ICONS.has(name);
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill={isFillIcon ? "inherit" : "none"}
      stroke={isFillIcon ? "none" : "currentColor"}
      strokeWidth={isFillIcon ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
