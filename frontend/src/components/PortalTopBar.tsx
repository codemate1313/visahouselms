import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import gsap from "gsap";
import { API_BASE_URL } from "../api/client";
import { logoutAndRedirectHome } from "../auth/logout";
import { useAuthStore } from "../store/authStore";
import { usePageTitleStore } from "../store/pageTitleStore";
import { Icon, type IconName } from "./icons";
import { NotificationBell } from "./StudentNotificationBell";
import { DashboardRangeAndThemeToggle } from "./DashboardRangeAndThemeToggle";
import { ThemeToggle } from "./ThemeToggle";

interface QuickLink {
  title: string;
  description: string;
  path: string;
  icon: IconName;
}

interface PortalTopBarProps {
  fallbackRoute: string;
  notificationEyebrow?: string;
  notificationsPath?: string;
  notificationsHref?: string;
  roleLabel?: string;
}

function getUserDisplayName(user: any): string {
  const firstName = user?.first_name || "";
  const lastName = user?.last_name || "";
  let full = `${firstName} ${lastName}`.trim();
  if (!full) full = user?.email || "Super Admin";

  if (user?.role === "SUPER_ADMIN") {
    if (!full.toLowerCase().includes("super admin")) {
      full = `${full} Super Admin`;
    }
  }
  return full;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

type PageMeta = { eyebrow: string; title: string };
type PageMetaRoute = {
  match: string | RegExp | Array<string | RegExp>;
  eyebrow: string;
  title: string | ((userGreetingName: string) => string);
};

const namedPageRoutes: PageMetaRoute[] = [
  { match: "/super-admin/dashboard", eyebrow: "PLATFORM OVERVIEW", title: (name) => `${getGreeting()}, ${name}` },
  { match: "/super-admin/accounts/new", eyebrow: "SYSTEM MANAGEMENT", title: "Create Admin Account" },
  { match: /\/super-admin\/accounts\/\d+/, eyebrow: "SYSTEM MANAGEMENT", title: "Edit Admin Account" },
  { match: "/super-admin/accounts", eyebrow: "SYSTEM MANAGEMENT", title: "Super Admin Accounts" },
  { match: "/super-admin/instructors/new", eyebrow: "FACULTY MANAGEMENT", title: "Create SA Instructor" },
  { match: /\/super-admin\/instructors\/\d+/, eyebrow: "FACULTY MANAGEMENT", title: "Edit SA Instructor" },
  { match: "/super-admin/instructors", eyebrow: "FACULTY MANAGEMENT", title: "SA Instructors" },
  { match: /\/super-admin\/modules\/\d+/, eyebrow: "COURSE MANAGEMENT", title: "Module Control Detail" },
  { match: "/super-admin/modules", eyebrow: "COURSE MANAGEMENT", title: "Course Control" },
  { match: "/super-admin/grading", eyebrow: "ACADEMICS", title: "Grading Oversight" },
  { match: "/super-admin/notifications", eyebrow: "NOTIFICATIONS", title: "Platform Notifications" },
  { match: "/super-admin/inbox", eyebrow: "NOTIFICATIONS", title: "Notifications Inbox" },
  { match: "/super-admin/testimonials", eyebrow: "CMS & CONTENT", title: "Student Testimonials" },
  { match: "/super-admin/blogs/new", eyebrow: "CMS & CONTENT", title: "Create Article" },
  { match: /\/super-admin\/blogs\/.+/, eyebrow: "CMS & CONTENT", title: "Edit Article" },
  { match: "/super-admin/blogs", eyebrow: "CMS & CONTENT", title: "Educational Blogs" },
  { match: "/super-admin/seo-settings", eyebrow: "CMS & CONTENT", title: "SEO & Meta Settings" },
  { match: "/super-admin/onboarding/new", eyebrow: "SAAS MANAGEMENT", title: "New Institute Onboarding" },
  { match: /\/super-admin\/onboarding\/\d+/, eyebrow: "SAAS MANAGEMENT", title: "Edit Institute Onboarding" },
  { match: "/super-admin/onboarding", eyebrow: "SAAS MANAGEMENT", title: "Institute Onboarding" },
  { match: "/super-admin/plans/new", eyebrow: "SAAS MANAGEMENT", title: "Create Direct Student Plan" },
  { match: /\/super-admin\/plans\/\d+/, eyebrow: "SAAS MANAGEMENT", title: "Edit Direct Student Plan" },
  { match: "/super-admin/plans", eyebrow: "SAAS MANAGEMENT", title: "Direct Student Plans" },
  { match: "/super-admin/subscriptions", eyebrow: "SAAS MANAGEMENT", title: "Access Agreements" },
  { match: "/super-admin/trial-config", eyebrow: "SAAS MANAGEMENT", title: "Trial Settings" },
  { match: "/super-admin/demo-accounts", eyebrow: "SAAS MANAGEMENT", title: "Demo Accounts" },
  { match: "/super-admin/coupons/new", eyebrow: "SAAS MANAGEMENT", title: "Create Discount Coupon" },
  { match: /\/super-admin\/coupons\/\d+/, eyebrow: "SAAS MANAGEMENT", title: "Edit Discount Coupon" },
  { match: "/super-admin/coupons", eyebrow: "SAAS MANAGEMENT", title: "Coupons" },
  { match: /\/super-admin\/payments\/\d+\/invoice/, eyebrow: "SAAS MANAGEMENT", title: "Payment Invoice" },
  { match: "/super-admin/payments", eyebrow: "SAAS MANAGEMENT", title: "Payments" },
  { match: "/super-admin/payment-methods", eyebrow: "SAAS MANAGEMENT", title: "Payment Methods" },
  { match: "/super-admin/revenue", eyebrow: "SAAS MANAGEMENT", title: "Revenue Dashboard" },
  { match: /\/super-admin\/institutes\/\d+\/branding/, eyebrow: "SAAS MANAGEMENT", title: "Institute Branding" },
  { match: /\/super-admin\/institutes\/\d+\/accounts/, eyebrow: "SAAS MANAGEMENT", title: "Institute Accounts" },
  { match: /\/super-admin\/institutes\/\d+\/students/, eyebrow: "SAAS MANAGEMENT", title: "Institute Students" },
  { match: "/super-admin/institutes/new", eyebrow: "SAAS MANAGEMENT", title: "Create Institute" },
  { match: /\/super-admin\/institutes\/\d+/, eyebrow: "SAAS MANAGEMENT", title: "Edit Institute" },
  { match: "/super-admin/institutes", eyebrow: "SAAS MANAGEMENT", title: "Institutes" },
  { match: "/super-admin/dev-settings", eyebrow: "SETTINGS", title: "Developer Settings" },
  { match: "/super-admin/logs", eyebrow: "SETTINGS", title: "System Logs" },
  { match: "/super-admin/terminal", eyebrow: "SETTINGS", title: "CMD Terminal" },
  { match: "/super-admin/profile", eyebrow: "ACCOUNT SETTINGS", title: "My Profile" },
  { match: "/super-admin/sessions", eyebrow: "ACCOUNT SETTINGS", title: "Active Sessions" },
  { match: "/super-admin/change-password", eyebrow: "ACCOUNT SETTINGS", title: "Change Password" },
  {
    match: ["/super-admin/instructor/dashboard", "/instructor-portal/dashboard"],
    eyebrow: "INSTRUCTOR PORTAL",
    title: (name) => `${getGreeting()}, ${name}`,
  },
  { match: ["/super-admin/instructor/modules", "/instructor-portal/modules"], eyebrow: "CONTENT AUTHORING", title: "Module Workspace" },
  { match: ["/super-admin/instructor/grading", "/instructor-portal/grading"], eyebrow: "EVALUATION", title: "Grading Queue" },
  { match: "/super-admin/instructor/notifications", eyebrow: "NOTIFICATIONS", title: "Notification Inbox" },
  { match: "/institute-portal/dashboard", eyebrow: "INSTITUTE PORTAL", title: (name) => `${getGreeting()}, ${name}` },
  { match: "/institute-portal/members", eyebrow: "INSTITUTE PORTAL", title: "Members & Staff" },
  { match: "/institute-portal/billing", eyebrow: "INSTITUTE PORTAL", title: "Subscription & Payments" },
  { match: "/institute-portal/announcements", eyebrow: "INSTITUTE PORTAL", title: "Announcements" },
  { match: "/student/dashboard", eyebrow: "STUDENT PORTAL", title: (name) => `${getGreeting()}, ${name}` },
  { match: "/student/courses", eyebrow: "STUDENT PORTAL", title: "My Courses" },
  { match: "/student/attempts", eyebrow: "STUDENT PORTAL", title: "Test Attempts" },
  { match: "/student/progress", eyebrow: "STUDENT PORTAL", title: "Progress & Analytics" },
  { match: "/student/announcements", eyebrow: "STUDENT PORTAL", title: "Announcements" },
  { match: "/student/profile", eyebrow: "ACCOUNT SETTINGS", title: "My Profile" },
];

function routeMatches(pathname: string, matcher: PageMetaRoute["match"]): boolean {
  if (Array.isArray(matcher)) return matcher.some((item) => routeMatches(pathname, item));
  if (typeof matcher === "string") return pathname.startsWith(matcher);
  return matcher.test(pathname);
}

function getPageMeta(pathname: string, user: any): PageMeta {
  const userGreetingName = getUserDisplayName(user);
  const route = namedPageRoutes.find((item) => routeMatches(pathname, item.match));
  if (!route) return { eyebrow: "IELTS LMS", title: "Portal Workspace" };
  return {
    eyebrow: route.eyebrow,
    title: typeof route.title === "function" ? route.title(userGreetingName) : route.title,
  };
}

function avatarUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

function userInitials(firstName: string | undefined, lastName: string | undefined, email: string | undefined) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.trim();
  if (initials) return initials.toUpperCase();
  return (email?.[0] ?? "U").toUpperCase();
}

function displayName(firstName: string | undefined, lastName: string | undefined, email: string | undefined) {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email || "User";
}

function readableRole(role: string | undefined) {
  if (!role) return "User";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function quickLinksForRole(role: string | undefined): QuickLink[] {
  const commonSettings: QuickLink[] = [
    { title: "My Profile", description: "Account details and avatar", path: "/profile", icon: "user" },
    { title: "Active Sessions", description: "Signed-in devices and sessions", path: "/sessions", icon: "session" },
    { title: "Change Password", description: "Update account password", path: "/change-password", icon: "lock" },
  ];

  if (role === "SUPER_ADMIN") return commonSettings.map((item) => ({ ...item, path: `/super-admin${item.path}` }));
  if (role === "SA_INSTRUCTOR") return commonSettings.map((item) => ({ ...item, path: `/super-admin/instructor${item.path}` }));
  if (role === "INSTITUTE_ADMIN") return commonSettings.map((item) => ({ ...item, path: `/institute-portal${item.path}` }));
  if (role === "INST_INSTRUCTOR") return commonSettings.slice(1).map((item) => ({ ...item, path: `/institute-instructor${item.path}` }));
  return commonSettings.map((item) => ({ ...item, path: `/student${item.path}` }));
}

export function PortalTopBar({
  fallbackRoute,
  notificationEyebrow,
  notificationsPath,
  notificationsHref,
  roleLabel,
}: PortalTopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const pageMeta = useMemo(() => getPageMeta(location.pathname, user), [location.pathname, user]);
  const resolvedAvatarUrl = avatarUrl(user?.avatar_url);
  const name = displayName(user?.first_name, user?.last_name, user?.email);
  const initials = userInitials(user?.first_name, user?.last_name, user?.email);
  const subtitle = roleLabel ?? readableRole(user?.role);
  const quickLinks = useMemo(() => quickLinksForRole(user?.role), [user?.role]);

  useEffect(() => {
    setImgError(false);
  }, [user?.avatar_url]);

  function openMenu() {
    setMenuOpen(true);
  }

  function closeMenuNow() {
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen || !dropdownRef.current) return;
    gsap.fromTo(
      dropdownRef.current,
      { opacity: 0, y: -16, scale: 0.86, transformOrigin: "top right" },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "elastic.out(1, 0.65)" },
    );
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenuNow();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenuNow();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  async function handleLogout() {
    closeMenuNow();
    await logoutAndRedirectHome();
  }

  const itemCount = usePageTitleStore((state) => state.itemCount);

  return (
    <header className="portal-app-bar">
      <div className="portal-app-title-group">
        <span className="portal-app-eyebrow">{pageMeta.eyebrow}</span>
        <div className="portal-app-heading-row">
          <h2 className="portal-app-heading">{pageMeta.title}</h2>
          {itemCount !== null && (
            <span className="portal-app-count-badge">
              ({itemCount} {itemCount === 1 ? "entry" : "entries"})
            </span>
          )}
        </div>
      </div>

      <div className="portal-app-actions">
        {(location.pathname === "/super-admin/dashboard" || location.pathname === "/super-admin/revenue") && (
          <DashboardRangeAndThemeToggle />
        )}
        <ThemeToggle className="portal-topbar-theme-toggle" />
        <NotificationBell eyebrow={notificationEyebrow} fallbackRoute={fallbackRoute} notificationsPath={notificationsPath} notificationsHref={notificationsHref} />
        <div className="portal-user-menu" ref={menuRef}>
          <button
            type="button"
            className="portal-user-chip"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => (menuOpen ? closeMenuNow() : openMenu())}
          >
            {resolvedAvatarUrl && !imgError ? (
              <img src={resolvedAvatarUrl} alt="" className="portal-user-avatar" onError={() => setImgError(true)} />
            ) : (
              <span className="portal-user-avatar is-initials">{initials}</span>
            )}
            <span className="portal-user-text">
              <strong>{name}</strong>
              <span>{subtitle}</span>
            </span>
            <Icon name="chevronDown" className={`portal-user-chevron${menuOpen ? " is-open" : ""}`} />
          </button>

          {menuOpen && (
            <div className="portal-user-dropdown" role="menu" ref={dropdownRef}>
              {quickLinks.map((item) => (
                <button
                  type="button"
                  role="menuitem"
                  key={item.path}
                  className="portal-user-dropdown-item"
                  onClick={() => {
                    closeMenuNow();
                    navigate(item.path);
                  }}
                >
                  <Icon name={item.icon} />
                  <span>
                    <strong>{item.title}</strong>
                    <em>{item.description}</em>
                  </span>
                </button>
              ))}
              <span className="portal-user-dropdown-divider" />
              <button type="button" role="menuitem" className="portal-user-dropdown-item is-logout" onClick={handleLogout}>
                <Icon name="logout" />
                <span><strong>Logout</strong></span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
