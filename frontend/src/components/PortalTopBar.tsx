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

const HOVER_CLOSE_DELAY = 220;

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

function getPageMeta(pathname: string, user: any): { eyebrow: string; title: string } {
  const userGreetingName = getUserDisplayName(user);

  // Super Admin Routes
  if (pathname.startsWith("/super-admin/dashboard")) {
    return { eyebrow: "PLATFORM OVERVIEW", title: `${getGreeting()}, ${userGreetingName}` };
  }
  if (pathname.startsWith("/super-admin/accounts/new")) {
    return { eyebrow: "SYSTEM MANAGEMENT", title: "Create Admin Account" };
  }
  if (pathname.match(/\/super-admin\/accounts\/\d+/)) {
    return { eyebrow: "SYSTEM MANAGEMENT", title: "Edit Admin Account" };
  }
  if (pathname.startsWith("/super-admin/accounts")) {
    return { eyebrow: "SYSTEM MANAGEMENT", title: "Super Admin Accounts" };
  }

  if (pathname.startsWith("/super-admin/instructors/new")) {
    return { eyebrow: "FACULTY MANAGEMENT", title: "Create SA Instructor" };
  }
  if (pathname.match(/\/super-admin\/instructors\/\d+/)) {
    return { eyebrow: "FACULTY MANAGEMENT", title: "Edit SA Instructor" };
  }
  if (pathname.startsWith("/super-admin/instructors")) {
    return { eyebrow: "FACULTY MANAGEMENT", title: "SA Instructors" };
  }

  if (pathname.match(/\/super-admin\/modules\/\d+/)) {
    return { eyebrow: "COURSE MANAGEMENT", title: "Module Control Detail" };
  }
  if (pathname.startsWith("/super-admin/modules")) {
    return { eyebrow: "COURSE MANAGEMENT", title: "Course Control" };
  }

  if (pathname.startsWith("/super-admin/grading")) {
    return { eyebrow: "ACADEMICS", title: "Grading Oversight" };
  }
  if (pathname.startsWith("/super-admin/notifications")) {
    return { eyebrow: "NOTIFICATIONS", title: "Platform Notifications" };
  }
  if (pathname.startsWith("/super-admin/inbox")) {
    return { eyebrow: "NOTIFICATIONS", title: "Notifications Inbox" };
  }

  if (pathname.startsWith("/super-admin/testimonials")) {
    return { eyebrow: "CMS & CONTENT", title: "Student Testimonials" };
  }
  if (pathname.startsWith("/super-admin/blogs/new")) {
    return { eyebrow: "CMS & CONTENT", title: "Create Article" };
  }
  if (pathname.match(/\/super-admin\/blogs\/.+/)) {
    return { eyebrow: "CMS & CONTENT", title: "Edit Article" };
  }
  if (pathname.startsWith("/super-admin/blogs")) {
    return { eyebrow: "CMS & CONTENT", title: "Educational Blogs" };
  }
  if (pathname.startsWith("/super-admin/seo-settings")) {
    return { eyebrow: "CMS & CONTENT", title: "SEO & Meta Settings" };
  }

  if (pathname.startsWith("/super-admin/onboarding/new")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "New Institute Onboarding" };
  }
  if (pathname.match(/\/super-admin\/onboarding\/\d+/)) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Edit Institute Onboarding" };
  }
  if (pathname.startsWith("/super-admin/onboarding")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Institute Onboarding" };
  }

  if (pathname.startsWith("/super-admin/plans/new")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Create Direct Student Plan" };
  }
  if (pathname.match(/\/super-admin\/plans\/\d+/)) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Edit Direct Student Plan" };
  }
  if (pathname.startsWith("/super-admin/plans")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Direct Student Plans" };
  }

  if (pathname.startsWith("/super-admin/subscriptions")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Access Agreements" };
  }
  if (pathname.startsWith("/super-admin/trial-config")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Trial Settings" };
  }
  if (pathname.startsWith("/super-admin/demo-accounts")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Demo Accounts" };
  }

  if (pathname.startsWith("/super-admin/coupons/new")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Create Discount Coupon" };
  }
  if (pathname.match(/\/super-admin\/coupons\/\d+/)) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Edit Discount Coupon" };
  }
  if (pathname.startsWith("/super-admin/coupons")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Coupons" };
  }

  if (pathname.match(/\/super-admin\/payments\/\d+\/invoice/)) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Payment Invoice" };
  }
  if (pathname.startsWith("/super-admin/payments")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Payments" };
  }
  if (pathname.startsWith("/super-admin/payment-methods")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Payment Methods" };
  }
  if (pathname.startsWith("/super-admin/revenue")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Revenue Dashboard" };
  }

  if (pathname.match(/\/super-admin\/institutes\/\d+\/branding/)) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Institute Branding" };
  }
  if (pathname.match(/\/super-admin\/institutes\/\d+\/accounts/)) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Institute Accounts" };
  }
  if (pathname.match(/\/super-admin\/institutes\/\d+\/students/)) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Institute Students" };
  }
  if (pathname.startsWith("/super-admin/institutes/new")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Create Institute" };
  }
  if (pathname.match(/\/super-admin\/institutes\/\d+/)) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Edit Institute" };
  }
  if (pathname.startsWith("/super-admin/institutes")) {
    return { eyebrow: "SAAS MANAGEMENT", title: "Institutes" };
  }

  if (pathname.startsWith("/super-admin/dev-settings")) {
    return { eyebrow: "SETTINGS", title: "Developer Settings" };
  }
  if (pathname.startsWith("/super-admin/logs")) {
    return { eyebrow: "SETTINGS", title: "System Logs" };
  }
  if (pathname.startsWith("/super-admin/terminal")) {
    return { eyebrow: "SETTINGS", title: "CMD Terminal" };
  }

  if (pathname.startsWith("/super-admin/profile")) {
    return { eyebrow: "ACCOUNT SETTINGS", title: "My Profile" };
  }
  if (pathname.startsWith("/super-admin/sessions")) {
    return { eyebrow: "ACCOUNT SETTINGS", title: "Active Sessions" };
  }
  if (pathname.startsWith("/super-admin/change-password")) {
    return { eyebrow: "ACCOUNT SETTINGS", title: "Change Password" };
  }

  // Instructor Portal Routes
  if (pathname.startsWith("/super-admin/instructor/dashboard") || pathname.startsWith("/instructor-portal/dashboard")) {
    return { eyebrow: "INSTRUCTOR PORTAL", title: `${getGreeting()}, ${userGreetingName}` };
  }
  if (pathname.startsWith("/super-admin/instructor/modules") || pathname.startsWith("/instructor-portal/modules")) {
    return { eyebrow: "CONTENT AUTHORING", title: "Module Workspace" };
  }
  if (pathname.startsWith("/super-admin/instructor/grading") || pathname.startsWith("/instructor-portal/grading")) {
    return { eyebrow: "EVALUATION", title: "Grading Queue" };
  }
  if (pathname.startsWith("/super-admin/instructor/notifications")) {
    return { eyebrow: "NOTIFICATIONS", title: "Notification Inbox" };
  }

  // Institute Portal Routes
  if (pathname.startsWith("/institute-portal/dashboard")) {
    return { eyebrow: "INSTITUTE PORTAL", title: `${getGreeting()}, ${userGreetingName}` };
  }
  if (pathname.startsWith("/institute-portal/members")) {
    return { eyebrow: "INSTITUTE PORTAL", title: "Members & Staff" };
  }
  if (pathname.startsWith("/institute-portal/billing")) {
    return { eyebrow: "INSTITUTE PORTAL", title: "Subscription & Payments" };
  }
  if (pathname.startsWith("/institute-portal/announcements")) {
    return { eyebrow: "INSTITUTE PORTAL", title: "Announcements" };
  }

  // Student Portal Routes
  if (pathname.startsWith("/student/dashboard")) {
    return { eyebrow: "STUDENT PORTAL", title: `${getGreeting()}, ${userGreetingName}` };
  }
  if (pathname.startsWith("/student/courses")) {
    return { eyebrow: "STUDENT PORTAL", title: "My Courses" };
  }
  if (pathname.startsWith("/student/attempts")) {
    return { eyebrow: "STUDENT PORTAL", title: "Test Attempts" };
  }
  if (pathname.startsWith("/student/progress")) {
    return { eyebrow: "STUDENT PORTAL", title: "Progress & Analytics" };
  }
  if (pathname.startsWith("/student/announcements")) {
    return { eyebrow: "STUDENT PORTAL", title: "Announcements" };
  }
  if (pathname.startsWith("/student/profile")) {
    return { eyebrow: "ACCOUNT SETTINGS", title: "My Profile" };
  }

  return { eyebrow: "IELTS LMS", title: "Portal Workspace" };
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
  const closeTimer = useRef<number | null>(null);

  const pageMeta = useMemo(() => getPageMeta(location.pathname, user), [location.pathname, user]);
  const resolvedAvatarUrl = avatarUrl(user?.avatar_url);
  const name = displayName(user?.first_name, user?.last_name, user?.email);
  const initials = userInitials(user?.first_name, user?.last_name, user?.email);
  const subtitle = roleLabel ?? readableRole(user?.role);
  const quickLinks = useMemo(() => quickLinksForRole(user?.role), [user?.role]);

  useEffect(() => {
    setImgError(false);
  }, [user?.avatar_url]);

  function cancelScheduledClose() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openMenu() {
    cancelScheduledClose();
    setMenuOpen(true);
  }

  function closeMenuNow() {
    cancelScheduledClose();
    setMenuOpen(false);
  }

  function scheduleClose() {
    cancelScheduledClose();
    closeTimer.current = window.setTimeout(() => {
      setMenuOpen(false);
      closeTimer.current = null;
    }, HOVER_CLOSE_DELAY);
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

  useEffect(() => () => cancelScheduledClose(), []);

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
        <NotificationBell eyebrow={notificationEyebrow} fallbackRoute={fallbackRoute} notificationsPath={notificationsPath} notificationsHref={notificationsHref} />
        <div
          className="portal-user-menu"
          ref={menuRef}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
        >
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
