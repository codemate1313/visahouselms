import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { Icon, type IconName } from "./icons";
import { NotificationBell } from "./StudentNotificationBell";

interface PortalSearchItem {
  title: string;
  description: string;
  path: string;
  icon: IconName;
  keywords?: string;
}

interface PortalTopBarProps {
  fallbackRoute: string;
  notificationEyebrow?: string;
  notificationsPath?: string;
  roleLabel?: string;
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

function searchItemsForUser(role: string | undefined, permissions: Record<string, boolean> | null | undefined, isInstituteStudent: boolean): PortalSearchItem[] {
  const commonSettings: PortalSearchItem[] = [
    { title: "My Profile", description: "Account details and avatar", path: "/profile", icon: "user", keywords: "account profile avatar user" },
    { title: "Active Sessions", description: "Signed-in devices and sessions", path: "/sessions", icon: "session", keywords: "device login active sessions" },
    { title: "Change Password", description: "Update account password", path: "/change-password", icon: "lock", keywords: "security password reset" },
  ];

  if (role === "SUPER_ADMIN") {
    return [
      { title: "Dashboard", description: "Platform overview", path: "/super-admin/dashboard", icon: "dashboard", keywords: "home overview analytics" },
      { title: "Admin Accounts", description: "Manage platform admins", path: "/super-admin/accounts", icon: "admin", keywords: "accounts users admins" },
      { title: "SA Instructors", description: "Manage SA instructors", path: "/super-admin/instructors", icon: "instructors", keywords: "teachers authors evaluators" },
      { title: "Course Control", description: "Courses, tests, and modules", path: "/super-admin/modules", icon: "module", keywords: "courses modules tests question banks" },
      { title: "Grading Oversight", description: "Review grading queues", path: "/super-admin/grading", icon: "grading", keywords: "evaluation review attempts" },
      { title: "Notifications", description: "Publish platform notifications", path: "/super-admin/notifications", icon: "notifications", keywords: "announcements messages" },
      { title: "Institutes", description: "Institute accounts and access", path: "/super-admin/institutes", icon: "building", keywords: "schools organizations saas" },
      { title: "Institute Onboarding", description: "Create institute onboarding", path: "/super-admin/onboarding", icon: "trial", keywords: "setup onboarding" },
      { title: "Direct Student Plans", description: "Plans and pricing", path: "/super-admin/plans", icon: "plan", keywords: "pricing subscription packages" },
      { title: "Access Agreements", description: "Institute subscriptions", path: "/super-admin/subscriptions", icon: "subscription", keywords: "contracts access subscription" },
      { title: "Trial Settings", description: "Trial access configuration", path: "/super-admin/trial-config", icon: "trial", keywords: "demo trial settings" },
      { title: "Demo Accounts", description: "Demo account access", path: "/super-admin/demo-accounts", icon: "demo", keywords: "trial demo testing" },
      { title: "Coupons", description: "Discount codes", path: "/super-admin/coupons", icon: "coupon", keywords: "offers discount promo" },
      { title: "Payments", description: "Payment records", path: "/super-admin/payments", icon: "payment", keywords: "billing invoices transactions" },
      { title: "Payment Methods", description: "Payment modes", path: "/super-admin/payment-methods", icon: "wallet", keywords: "wallet bank method" },
      { title: "Revenue", description: "Revenue dashboard", path: "/super-admin/revenue", icon: "revenue", keywords: "income reports sales" },
      { title: "Testimonials", description: "Website testimonials", path: "/super-admin/testimonials", icon: "user", keywords: "cms content reviews" },
      { title: "Blogs CMS", description: "Website blog content", path: "/super-admin/blogs", icon: "module", keywords: "cms content posts articles" },
      { title: "SEO & Meta Settings", description: "Public site SEO", path: "/super-admin/seo-settings", icon: "settings", keywords: "metadata search engine" },
      { title: "Developer Settings", description: "System integrations", path: "/super-admin/dev-settings", icon: "settings", keywords: "api avatar ai smtp openai did" },
      { title: "Logs", description: "Application logs", path: "/super-admin/logs", icon: "logs", keywords: "errors events" },
      { title: "CMD Terminal", description: "Command terminal", path: "/super-admin/terminal", icon: "terminal", keywords: "shell command" },
      ...commonSettings.map((item) => ({ ...item, path: `/super-admin${item.path}` })),
    ];
  }

  if (role === "SA_INSTRUCTOR") {
    return [
      { title: "Dashboard", description: "Author overview", path: "/super-admin/instructor/dashboard", icon: "dashboard", keywords: "home overview" },
      { title: "Courses", description: "Author courses and modules", path: "/super-admin/instructor/modules", icon: "module", keywords: "modules tests question banks authoring" },
      { title: "Grading Queue", description: "Evaluate submitted tests", path: "/super-admin/instructor/grading", icon: "grading", keywords: "review evaluation attempts" },
      ...commonSettings.map((item) => ({ ...item, path: `/super-admin/instructor${item.path}` })),
    ];
  }

  if (role === "INSTITUTE_ADMIN") {
    const items: PortalSearchItem[] = [
      { title: "Dashboard", description: "Institute overview", path: "/institute-portal/dashboard", icon: "dashboard", keywords: "home analytics" },
    ];
    if (permissions?.view_students || permissions?.manage_students || permissions?.view_student_activity || permissions?.manage_student_sessions) {
      items.push(
        { title: "Students", description: "Student directory", path: "/institute-portal/students", icon: "user", keywords: "learners accounts members" },
        { title: "Announcements", description: "Institute notifications", path: "/institute-portal/announcements", icon: "notifications", keywords: "messages updates" },
      );
    }
    if (permissions?.manage_staff) {
      items.push({ title: "Instructors", description: "Institute staff", path: "/institute-portal/staff", icon: "instructors", keywords: "teachers evaluators staff" });
    }
    if (permissions?.view_billing) {
      items.push({ title: "Subscription", description: "Billing and access", path: "/institute-portal/billing", icon: "subscription", keywords: "agreement payment plan" });
    }
    return [...items, ...commonSettings.map((item) => ({ ...item, path: `/institute-portal${item.path}` }))];
  }

  if (role === "INST_INSTRUCTOR") {
    return [
      { title: "Grading Queue", description: "Evaluate institute students", path: "/institute-instructor/grading", icon: "grading", keywords: "review evaluation attempts" },
      ...commonSettings.slice(1).map((item) => ({ ...item, path: `/institute-instructor${item.path}` })),
    ];
  }

  return [
    { title: "Dashboard", description: "Student overview", path: "/student/dashboard", icon: "dashboard", keywords: "home overview" },
    ...(isInstituteStudent ? [] : [{ title: "Plans & Upgrades", description: "Browse available plans", path: "/student/courses", icon: "courses" as const, keywords: "courses catalog pricing upgrade" }]),
    { title: "My Tests", description: "Assigned and purchased tests", path: "/student/my-courses", icon: "module", keywords: "courses modules practice" },
    { title: "My Test History", description: "Submitted attempts and results", path: "/student/attempts", icon: "grading", keywords: "attempts results scores review" },
    { title: "Progress", description: "Performance analytics", path: "/student/progress", icon: "analytics", keywords: "analytics scores improvement" },
    { title: "Announcements", description: "Student notifications", path: "/student/announcements", icon: "notifications", keywords: "messages updates" },
    ...commonSettings.map((item) => ({ ...item, path: `/student${item.path}` })),
  ];
}

export function PortalTopBar({
  fallbackRoute,
  notificationEyebrow,
  notificationsPath,
  roleLabel,
}: PortalTopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const [query, setQuery] = useState("");
  const [dashboardTerms, setDashboardTerms] = useState<string[]>([]);
  const resolvedAvatarUrl = avatarUrl(user?.avatar_url);
  const name = displayName(user?.first_name, user?.last_name, user?.email);
  const initials = userInitials(user?.first_name, user?.last_name, user?.email);
  const subtitle = roleLabel ?? readableRole(user?.role);
  const searchItems = useMemo(
    () => searchItemsForUser(user?.role, user?.institute_permissions, user?.role === "STUDENT" && user.institute_id != null),
    [user?.institute_id, user?.institute_permissions, user?.role],
  );
  const pageResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return searchItems.slice(0, 8);
    return searchItems
      .filter((item) => `${item.title} ${item.description} ${item.keywords ?? ""}`.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [query, searchItems]);
  const dashboardResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return dashboardTerms.slice(0, 8);
    return dashboardTerms.filter((term) => term.toLowerCase().includes(normalized)).slice(0, 8);
  }, [dashboardTerms, query]);
  const suggestionValues = useMemo(() => {
    const values = new Set<string>();
    pageResults.forEach((item) => values.add(`${item.title} - ${item.description}`));
    dashboardResults.forEach((term) => values.add(term));
    return Array.from(values).slice(0, 16);
  }, [dashboardResults, pageResults]);

  useEffect(() => {
    const collectTerms = () => {
      const root = document.querySelector(".dashboard-content .gsap-route-scope") ?? document.querySelector(".dashboard-content");
      if (!root) return;
      const seen = new Set<string>();
      const selectors = "h1,h2,h3,h4,button,a,label,th,td,strong,.page-eyebrow,.count-chip,.badge,.phase-chip";
      root.querySelectorAll<HTMLElement>(selectors).forEach((element) => {
        if (element.closest(".portal-app-bar")) return;
        const text = element.innerText.replace(/\s+/g, " ").trim();
        if (text.length < 2 || text.length > 80) return;
        seen.add(text);
      });
      setDashboardTerms(Array.from(seen).slice(0, 80));
    };
    const timer = window.setTimeout(collectTerms, 120);
    const root = document.querySelector(".dashboard-content");
    const observer = new MutationObserver(collectTerms);
    if (root) {
      observer.observe(root, { childList: true, subtree: true, characterData: true });
    }
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [location.pathname]);

  function openSearchValue(value: string) {
    const normalized = value.trim().toLowerCase();
    const page = searchItems.find((item) => {
      const label = `${item.title} - ${item.description}`.toLowerCase();
      return item.title.toLowerCase() === normalized || item.path.toLowerCase() === normalized || label === normalized;
    });
    if (!page) return;
    setQuery("");
    navigate(page.path);
  }

  return (
    <header className="portal-app-bar">
      <div className="portal-app-search">
        <Icon name="search" />
        <input
          type="search"
          aria-label="Search anything"
          placeholder="Search anything"
          list="portal-search-suggestions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              openSearchValue(query);
            }
          }}
        />
        <datalist id="portal-search-suggestions">
          {suggestionValues.map((value) => (
            <option value={value} key={value} />
          ))}
        </datalist>
      </div>

      <div className="portal-app-actions">
        <NotificationBell eyebrow={notificationEyebrow} fallbackRoute={fallbackRoute} notificationsPath={notificationsPath} />
        <span className="portal-app-divider" aria-hidden="true" />
        <div className="portal-user-chip">
          {resolvedAvatarUrl ? (
            <img src={resolvedAvatarUrl} alt="" className="portal-user-avatar" />
          ) : (
            <span className="portal-user-avatar is-initials">{initials}</span>
          )}
          <span className="portal-user-text">
            <strong>{name}</strong>
            <span>{subtitle}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
