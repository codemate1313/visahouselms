import type { ReactNode } from "react";

export type IconName =
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
  | "help"
  | "logout"
  | "chevronDown"
  | "overview"
  | "projects";

const ICON_PATHS: Record<IconName, ReactNode> = {
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
      <circle cx="18" cy="5" r="2" fill="#ef4444" stroke="none" />
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
  // Chevron Down Icon
  chevronDown: <path d="M6 9l6 6 6-6" />,

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
};

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
