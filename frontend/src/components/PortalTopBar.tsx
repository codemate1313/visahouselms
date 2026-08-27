import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import gsap from "gsap";
import { API_BASE_URL } from "../api/client";
import { logoutAndRedirectHome } from "../auth/logout";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useAuthStore } from "../store/authStore";
import { usePageTitleStore } from "../store/pageTitleStore";
import { Icon, type IconName } from "./icons";
import { NotificationBell } from "./StudentNotificationBell";
import { DashboardRangeAndThemeToggle } from "./DashboardRangeAndThemeToggle";
import { ThemeToggle } from "./ThemeToggle";
import { commonActions } from "@/content/common.strings";

interface QuickLink {
  title: string;
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
  // Super Admin Routes
  { match: "/super-admin/dashboard", eyebrow: "Platform Overview", title: (name) => `${getGreeting()}, ${name}` },
  { match: "/super-admin/users/super-admins", eyebrow: "User Management", title: "Super Admins" },
  { match: "/super-admin/users/sa-instructors", eyebrow: "User Management", title: "SA Instructors" },
  { match: "/super-admin/users/institute-admins", eyebrow: "User Management", title: "Institute Admins" },
  { match: "/super-admin/users/institute-staff", eyebrow: "User Management", title: "Institute Staff" },
  { match: "/super-admin/users/students", eyebrow: "User Management", title: "Students" },
  { match: "/super-admin/users/all-users", eyebrow: "User Management", title: "All Users" },
  { match: "/super-admin/users", eyebrow: "User Management", title: "Users" },
  { match: "/super-admin/accounts/new", eyebrow: "System Management", title: "Create Admin Account" },
  { match: /\/super-admin\/accounts\/\d+/, eyebrow: "System Management", title: "Edit Admin Account" },
  { match: "/super-admin/accounts", eyebrow: "System Management", title: "Super Admin Accounts" },
  { match: "/super-admin/instructors/new", eyebrow: "Faculty Management", title: "Create SA Instructor" },
  { match: /\/super-admin\/instructors\/\d+/, eyebrow: "Faculty Management", title: "Edit SA Instructor" },
  { match: "/super-admin/instructors", eyebrow: "Faculty Management", title: "SA Instructors" },
  { match: /\/super-admin\/modules\/\d+/, eyebrow: "Course Management", title: "Module Control Detail" },
  { match: "/super-admin/modules", eyebrow: "Course Management", title: "Course Control" },
  { match: "/super-admin/grading", eyebrow: "Academics", title: "Grading Oversight" },
  { match: "/super-admin/notifications", eyebrow: "Notifications", title: "Platform Notifications" },
  { match: "/super-admin/inbox", eyebrow: "Notifications", title: "Notifications Inbox" },
  { match: "/super-admin/testimonials", eyebrow: "CMS & Content", title: "Student Testimonials" },
  { match: "/super-admin/blogs/new", eyebrow: "CMS & Content", title: "Create Article" },
  { match: /\/super-admin\/blogs\/.+/, eyebrow: "CMS & Content", title: "Edit Article" },
  { match: "/super-admin/blogs", eyebrow: "CMS & Content", title: "Educational Blogs" },
  { match: "/super-admin/seo-settings", eyebrow: "CMS & Content", title: "SEO & Meta Settings" },
  { match: "/super-admin/instagram-settings", eyebrow: "CMS & Content", title: "Instagram Graph API & Reels" },
  { match: "/super-admin/onboarding/new", eyebrow: "SaaS Management", title: "New Institute Onboarding" },
  { match: /\/super-admin\/onboarding\/\d+/, eyebrow: "SaaS Management", title: "Edit Institute Onboarding" },
  { match: "/super-admin/onboarding", eyebrow: "SaaS Management", title: "Institute Onboarding" },
  { match: "/super-admin/plans/new", eyebrow: "SaaS Management", title: "Create Plan" },
  { match: /\/super-admin\/plans\/\d+/, eyebrow: "SaaS Management", title: "Edit Plan" },
  { match: "/super-admin/plans", eyebrow: "SaaS Management", title: "Subscription Plans" },
  { match: "/super-admin/subscriptions", eyebrow: "SaaS Management", title: "Access Agreements" },
  { match: "/super-admin/trial-config", eyebrow: "SaaS Management", title: "Trial Settings" },
  { match: "/super-admin/coupons/new", eyebrow: "SaaS Management", title: "Create Discount Coupon" },
  { match: /\/super-admin\/coupons\/\d+/, eyebrow: "SaaS Management", title: "Edit Discount Coupon" },
  { match: "/super-admin/coupons", eyebrow: "SaaS Management", title: "Coupons" },
  { match: /\/super-admin\/payments\/\d+\/invoice/, eyebrow: "SaaS Management", title: "Payment Invoice" },
  { match: "/super-admin/payments", eyebrow: "SaaS Management", title: "Payments" },
  { match: "/super-admin/payment-methods", eyebrow: "SaaS Management", title: "Payment Methods" },
  { match: "/super-admin/gst-rates", eyebrow: "SaaS Management", title: "GST Master" },
  { match: "/super-admin/revenue", eyebrow: "SaaS Management", title: "Revenue Dashboard" },
  { match: /\/super-admin\/institutes\/\d+\/branding/, eyebrow: "SaaS Management", title: "Institute Branding" },
  { match: /\/super-admin\/institutes\/\d+\/accounts/, eyebrow: "SaaS Management", title: "Institute Accounts" },
  { match: /\/super-admin\/institutes\/\d+\/students/, eyebrow: "SaaS Management", title: "Institute Students" },
  { match: "/super-admin/institutes/new", eyebrow: "SaaS Management", title: "Create Institute" },
  { match: /\/super-admin\/institutes\/\d+/, eyebrow: "SaaS Management", title: "Edit Institute" },
  { match: "/super-admin/institutes", eyebrow: "SaaS Management", title: "Institutes" },
  { match: "/super-admin/retake-requests", eyebrow: "Academics", title: "Retake Requests" },
  { match: "/super-admin/vouchers", eyebrow: "SaaS Management", title: "Vouchers" },
  { match: "/super-admin/institute-signups", eyebrow: "SaaS Management", title: "Institute Applications" },
  { match: ["/super-admin/dev-settings", "/super-admin/platform-settings"], eyebrow: "Settings", title: "Platform Settings" },
  { match: "/super-admin/logs", eyebrow: "Settings", title: "System Logs" },
  { match: "/super-admin/terminal", eyebrow: "Settings", title: "CMD Terminal" },

  // Student Portal Routes (Ordered specific before general)
  { match: "/student/dashboard", eyebrow: "Overview", title: (name) => `${getGreeting()}, ${name}` },
  { match: ["/student/courses", "/student/course-catalog", "/student/plans"], eyebrow: "Academics", title: "Plans & Upgrades" },
  { match: "/student/my-courses", eyebrow: "Academics", title: "My Tests" },
  { match: /\/student\/attempts\/\d+\/result\/details/, eyebrow: "Academics", title: "Question Review" },
  { match: /\/student\/attempts\/\d+\/result/, eyebrow: "Academics", title: "Attempt Result" },
  { match: /\/student\/attempts\/\d+\/take/, eyebrow: "Examination", title: "Live Test Runner" },
  { match: "/student/attempts", eyebrow: "Academics", title: "My Test History" },
  { match: "/student/study-material", eyebrow: "Academics", title: "Study Material" },
  { match: "/student/progress", eyebrow: "Analytics", title: "Progress" },
  { match: "/student/news", eyebrow: "Information", title: "News" },
  { match: "/student/announcements", eyebrow: "Communications", title: "Announcements" },
  { match: "/student/notifications", eyebrow: "Notifications", title: "Notifications Inbox" },
  { match: "/student/vouchers", eyebrow: "Academics", title: "Exam Vouchers" },
  { match: "/student/purchase-history", eyebrow: "Billing", title: "Purchase History" },
  { match: "/student/support", eyebrow: "Support & Helpdesk", title: "Raise a Query" },

  // Institute Admin Routes
  { match: "/institute-portal/dashboard", eyebrow: "Institute Workspace", title: (name) => `${getGreeting()}, ${name}` },
  { match: "/institute-portal/setup", eyebrow: "Onboarding", title: "Institute Setup" },
  { match: "/institute-portal/students/new", eyebrow: "Members", title: "Add Student" },
  { match: /\/institute-portal\/students\/\d+\/edit/, eyebrow: "Members", title: "Edit Student" },
  { match: /\/institute-portal\/students\/\d+/, eyebrow: "Members", title: "Student Overview" },
  { match: "/institute-portal/students", eyebrow: "Members", title: "Students" },
  { match: "/institute-portal/staff/new", eyebrow: "Members", title: "Add Instructor" },
  { match: /\/institute-portal\/staff\/\d+/, eyebrow: "Members", title: "Edit Instructor" },
  { match: "/institute-portal/staff", eyebrow: "Members", title: "Faculty Staff" },
  { match: "/institute-portal/billing", eyebrow: "Finance", title: "Billing & Invoices" },
  { match: "/institute-portal/branding", eyebrow: "Customization", title: "Institute Branding" },
  { match: "/institute-portal/announcements", eyebrow: "Communications", title: "Institute Announcements" },
  { match: "/institute-portal/notifications", eyebrow: "Notifications", title: "Notifications Inbox" },
  { match: ["/institute-portal/support-tickets", "/institute/support-tickets"], eyebrow: "Support & Helpdesk", title: "Support Tickets" },
  { match: "/institute-portal/support", eyebrow: "Support & Helpdesk", title: "Support Center" },

  // SA Instructor Routes
  { match: "/super-admin/instructor/dashboard", eyebrow: "Instructor Workspace", title: (name) => `${getGreeting()}, ${name}` },
  { match: /\/super-admin\/instructor\/modules\/new\/.+/, eyebrow: "Course Management", title: "Create Module" },
  { match: /\/super-admin\/instructor\/modules\/\d+/, eyebrow: "Course Management", title: "Edit Module" },
  { match: "/super-admin/instructor/modules", eyebrow: "Course Management", title: "Module Workspace" },
  { match: /\/super-admin\/instructor\/grading\/\d+/, eyebrow: "Academics", title: "Grade Submission" },
  { match: "/super-admin/instructor/grading", eyebrow: "Academics", title: "Grading Queue" },
  { match: "/super-admin/instructor/grammar-content", eyebrow: "Academics", title: "Grammar Content" },
  { match: "/super-admin/instructor/notifications", eyebrow: "Notifications", title: "Notifications Inbox" },
  { match: "/super-admin/instructor/support", eyebrow: "Support & Helpdesk", title: "Support Center" },

  // Institute Instructor Routes
  { match: "/institute-instructor/dashboard", eyebrow: "Instructor Workspace", title: (name) => `${getGreeting()}, ${name}` },
  { match: /\/institute-instructor\/grading\/\d+/, eyebrow: "Academics", title: "Grade Submission" },
  { match: "/institute-instructor/grading", eyebrow: "Academics", title: "Grading Queue" },
  { match: "/institute-instructor/notifications", eyebrow: "Notifications", title: "Notifications Inbox" },
  { match: "/institute-instructor/support", eyebrow: "Support & Helpdesk", title: "Support Center" },

  // Common Support & Account Routes
  { match: ["/super-admin/support-tickets", "/institute-portal/support-tickets", "/institute/support-tickets"], eyebrow: "Support & Helpdesk", title: "Support Tickets" },
  { match: ["/super-admin/profile", "/institute-portal/profile", "/instructor-portal/profile", "/institute-instructor/profile", "/student/profile"], eyebrow: "Account", title: "My Profile" },
  { match: ["/super-admin/sessions", "/institute-portal/sessions", "/instructor-portal/sessions", "/institute-instructor/sessions", "/student/sessions"], eyebrow: "Account", title: "Active Sessions" },
  { match: ["/super-admin/change-password", "/institute-portal/change-password", "/instructor-portal/change-password", "/institute-instructor/change-password", "/student/change-password"], eyebrow: "Account", title: "Change Password" },
];

function routeMatches(pathname: string, matcher: PageMetaRoute["match"]): boolean {
  if (Array.isArray(matcher)) return matcher.some((item) => routeMatches(pathname, item));
  if (typeof matcher === "string") {
    return pathname === matcher || pathname.startsWith(matcher.endsWith("/") ? matcher : `${matcher}/`);
  }
  return matcher.test(pathname);
}

function getPageMeta(pathname: string, user: any): PageMeta {
  const userGreetingName = getUserDisplayName(user);
  const route = namedPageRoutes.find((item) => routeMatches(pathname, item.match));
  if (!route) return { eyebrow: "Language CERT", title: "Portal Workspace" };
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
  const f = firstName?.trim() || "";
  const l = lastName?.trim() || "";
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f.length >= 2) return f.slice(0, 2).toUpperCase();
  if (f) return f[0].toUpperCase();
  if (email?.trim() && email.trim().length >= 2) return email.trim().slice(0, 2).toUpperCase();
  if (email?.trim()) return email.trim()[0].toUpperCase();
  return "SA";
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
    { title: "My Profile", path: "/profile", icon: "user" },
    { title: "Active Sessions", path: "/sessions", icon: "session" },
    { title: "Change Password", path: "/change-password", icon: "lock" },
  ];

  if (role === "SUPER_ADMIN") return commonSettings.map((item) => ({ ...item, path: `/super-admin${item.path}` }));
  if (role === "SA_INSTRUCTOR") return commonSettings.map((item) => ({ ...item, path: `/super-admin/instructor${item.path}` }));
  if (role === "INSTITUTE_ADMIN") return commonSettings.map((item) => ({ ...item, path: `/institute-portal${item.path}` }));
  if (role === "INST_INSTRUCTOR") return commonSettings.map((item) => ({ ...item, path: `/institute-instructor${item.path}` }));
  return commonSettings.map((item) => ({ ...item, path: `/student${item.path}` }));
}

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

function getBreadcrumbs(pathname: string, eyebrow: string, title: string): BreadcrumbItem[] {
  // Institutes sub-routes
  if (/\b\/institutes\/\d+\/branding\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Institutes", path: "/super-admin/institutes" },
      { label: "Institute Branding" }
    ];
  }
  if (/\b\/institutes\/\d+\/accounts\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Institutes", path: "/super-admin/institutes" },
      { label: "Institute Accounts" }
    ];
  }
  if (/\b\/institutes\/\d+\/students\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Institutes", path: "/super-admin/institutes" },
      { label: "Institute Students" }
    ];
  }
  if (pathname === "/super-admin/institutes/new") {
    return [
      { label: eyebrow },
      { label: "Institutes", path: "/super-admin/institutes" },
      { label: "Create Institute" }
    ];
  }
  if (/\b\/institutes\/\d+\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Institutes", path: "/super-admin/institutes" },
      { label: "Edit Institute" }
    ];
  }

  // Onboarding sub-routes
  if (pathname === "/super-admin/onboarding/new") {
    return [
      { label: eyebrow },
      { label: "Institute Onboarding", path: "/super-admin/onboarding" },
      { label: "New Onboarding" }
    ];
  }
  if (/\b\/onboarding\/\d+\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Institute Onboarding", path: "/super-admin/onboarding" },
      { label: "Edit Onboarding" }
    ];
  }


  // Plans sub-routes. Both catalogues live under the same path, so the crumb
  // points back at the screen rather than naming one of them.
  if (pathname === "/super-admin/plans/new") {
    return [
      { label: eyebrow },
      { label: "Subscription Plans", path: "/super-admin/plans" },
      { label: "New Plan" }
    ];
  }
  if (/\b\/plans\/\d+\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Subscription Plans", path: "/super-admin/plans" },
      { label: "Edit Plan" }
    ];
  }

  // Coupons sub-routes
  if (pathname === "/super-admin/coupons/new") {
    return [
      { label: eyebrow },
      { label: "Coupons", path: "/super-admin/coupons" },
      { label: "New Coupon" }
    ];
  }
  if (/\b\/coupons\/\d+\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Coupons", path: "/super-admin/coupons" },
      { label: "Edit Coupon" }
    ];
  }

  // Blogs sub-routes
  if (pathname === "/super-admin/blogs/new") {
    return [
      { label: eyebrow },
      { label: "Educational Blogs", path: "/super-admin/blogs" },
      { label: "New Article" }
    ];
  }
  if (/\b\/blogs\/.+/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Educational Blogs", path: "/super-admin/blogs" },
      { label: "Edit Article" }
    ];
  }

  // Modules sub-routes
  if (/\b\/modules\/\d+\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Course Control", path: "/super-admin/modules" },
      { label: "Module Detail" }
    ];
  }

  // Instructor sub-routes
  if (pathname === "/super-admin/instructor/modules/new") {
    return [
      { label: eyebrow },
      { label: "Module Workspace", path: "/super-admin/instructor/modules" },
      { label: "New Module" }
    ];
  }
  if (/\b\/instructor\/modules\/\d+\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Module Workspace", path: "/super-admin/instructor/modules" },
      { label: "Edit Module" }
    ];
  }
  if (/\b\/instructor\/grading\/\d+\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Grading Queue", path: "/super-admin/instructor/grading" },
      { label: "Grading Detail" }
    ];
  }

  // Payments sub-routes
  if (/\b\/payments\/\d+\/invoice\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Payments", path: "/super-admin/payments" },
      { label: "Invoice" }
    ];
  }

  // Student test attempts sub-routes
  if (/\/student\/attempts\/\d+\/result\/details\b/.test(pathname)) {
    const attemptId = pathname.match(/\/student\/attempts\/(\d+)\/result\/details/)?.[1];
    return [
      { label: eyebrow },
      { label: "My Test History", path: "/student/attempts" },
      { label: "Attempt Result", path: `/student/attempts/${attemptId}/result` },
      { label: "Question Review" }
    ];
  }
  if (/\/student\/attempts\/\d+\/result\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "My Test History", path: "/student/attempts" },
      { label: "Attempt Result" }
    ];
  }

  // Institute sub-routes
  if (pathname === "/institute-portal/students/new") {
    return [
      { label: eyebrow },
      { label: "Students", path: "/institute-portal/students" },
      { label: "Add Student" }
    ];
  }
  if (/\/institute-portal\/students\/\d+\/edit\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Students", path: "/institute-portal/students" },
      { label: "Edit Student" }
    ];
  }
  if (/\/institute-portal\/students\/\d+\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Students", path: "/institute-portal/students" },
      { label: "Student Overview" }
    ];
  }
  if (pathname === "/institute-portal/staff/new") {
    return [
      { label: eyebrow },
      { label: "Faculty Staff", path: "/institute-portal/staff" },
      { label: "Add Instructor" }
    ];
  }
  if (/\/institute-portal\/staff\/\d+\b/.test(pathname)) {
    return [
      { label: eyebrow },
      { label: "Faculty Staff", path: "/institute-portal/staff" },
      { label: "Edit Instructor" }
    ];
  }

  // Main dashboard pages: hide greeting title from top breadcrumbs
  if (
    pathname === "/super-admin/dashboard" ||
    pathname === "/super-admin" ||
    pathname === "/institute-portal/dashboard" ||
    pathname === "/student/dashboard" ||
    pathname === "/instructor-portal/dashboard" ||
    pathname === "/institute-instructor/dashboard"
  ) {
    return [{ label: eyebrow }];
  }

  // Default top-level page
  return [
    { label: eyebrow },
    { label: title }
  ];
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
  usePushNotifications(user?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const customBreadcrumbs = usePageTitleStore((state) => state.customBreadcrumbs);
  const pageMeta = useMemo(() => getPageMeta(location.pathname, user), [location.pathname, user]);
  const breadcrumbs = useMemo(() => {
    if (customBreadcrumbs && customBreadcrumbs.length > 0) {
      return customBreadcrumbs;
    }
    return getBreadcrumbs(location.pathname, pageMeta.eyebrow, pageMeta.title);
  }, [customBreadcrumbs, location.pathname, pageMeta.eyebrow, pageMeta.title]);
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

  function handleBack() {
    const historyIndex = Number(window.history.state?.idx ?? 0);
    if (historyIndex > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackRoute, { replace: true });
  }

  const itemCount = usePageTitleStore((state) => state.itemCount);
  const topBarAction = usePageTitleStore((state) => state.topBarAction);
  const currentPath = location.pathname.replace(/\/+$/, "");
  const portalHomePath = fallbackRoute.replace(/\/+$/, "");
  // An institute held in setup has nowhere to go back to - every other portal
  // route redirects straight back here - so walking history only pops entries
  // from before it was signed in. Treated as a home path, like the portal roots
  // and the test engine.
  const isTerminalPath =
    currentPath === "/institute-portal/setup" ||
    /^\/student\/attempts\/[^/]+\/take$/.test(currentPath);
  const showBackButton = currentPath !== portalHomePath && !isTerminalPath;
  const currentTitle = customBreadcrumbs && customBreadcrumbs.length > 0
    ? customBreadcrumbs[customBreadcrumbs.length - 1].label
    : pageMeta.title;

  return (
    <header className="portal-app-bar">
      <div className="portal-app-title-group">
        <nav aria-label="Breadcrumb" className="portal-breadcrumb-nav">
          <ol className="portal-breadcrumb-list">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <li key={idx} className={`portal-breadcrumb-item${isLast ? " is-active" : ""}`}>
                  {idx > 0 && <span className="portal-breadcrumb-separator">/</span>}
                  {crumb.path && !isLast ? (
                    <Link to={crumb.path} className="portal-breadcrumb-link">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="portal-breadcrumb-text">{crumb.label}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="portal-app-heading-row">
          {showBackButton && (
            <button
              type="button"
              className="portal-back-button"
              onClick={handleBack}
              aria-label={commonActions.back}
              title={commonActions.back}
            >
              <Icon name="arrowLeft" />
            </button>
          )}
          <h2 className="portal-app-heading">{currentTitle}</h2>
          {itemCount !== null && (
            <span className="portal-app-count-badge">
              {itemCount} {itemCount === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>
      </div>

      <div className="portal-app-actions">
        {(location.pathname === "/super-admin/dashboard" || location.pathname === "/super-admin/revenue") && (
          <DashboardRangeAndThemeToggle />
        )}
        {topBarAction}
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
