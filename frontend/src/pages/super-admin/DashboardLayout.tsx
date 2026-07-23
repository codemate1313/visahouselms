import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "../../auth/logout";
import { GsapRouteAnimator } from "../../components/GsapRouteAnimator";
import { NotificationBell } from "../../components/StudentNotificationBell";
import { Sidebar, type MenuSection } from "../../components/Sidebar";

const COLLAPSE_STORAGE_KEY = "ielts-lms-sidebar-collapsed";

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function handleLogout() {
    await logoutAndRedirectHome();
  }

  // Original IELTS LMS Super Admin Menu Configuration
  const sections: MenuSection[] = [
    {
      title: "MAIN MENU",
      items: [
        {
          key: "dashboard",
          label: "Dashboard",
          icon: "dashboard",
          to: "/super-admin/dashboard",
        },
        {
          key: "accounts",
          label: "Admin Accounts",
          icon: "admin",
          to: "/super-admin/accounts",
        },
        {
          key: "instructors",
          label: "SA Instructors",
          icon: "instructors",
          to: "/super-admin/instructors",
        },
        {
          key: "courses",
          label: "Course Control",
          icon: "module",
          to: "/super-admin/modules",
        },
        {
          key: "grading-oversight",
          label: "Grading Oversight",
          icon: "grading",
          to: "/super-admin/grading",
        },
        {
          key: "notifications",
          label: "Notifications",
          icon: "notifications",
          to: "/super-admin/notifications",
        },
        {
          key: "saas",
          label: "SaaS",
          icon: "building",
          children: [
            { key: "saas_institutes", label: "Institutes", to: "/super-admin/institutes" },
            { key: "saas_onboarding", label: "Institute Onboarding", to: "/super-admin/onboarding" },
            { key: "saas_plans", label: "Direct Student Plans", to: "/super-admin/plans" },
            { key: "saas_subscriptions", label: "Access Agreements", to: "/super-admin/subscriptions" },
            { key: "saas_trial", label: "Trial Settings", to: "/super-admin/trial-config" },
            { key: "saas_demo", label: "Demo Accounts", to: "/super-admin/demo-accounts" },
            { key: "saas_coupons", label: "Coupons", to: "/super-admin/coupons" },
            { key: "saas_payments", label: "Payments", to: "/super-admin/payments" },
            { key: "saas_payment_methods", label: "Payment Methods", to: "/super-admin/payment-methods" },
            { key: "saas_revenue", label: "Revenue", to: "/super-admin/revenue" },
          ],
        },
      ],
    },
    {
      title: "CMS & CONTENT",
      items: [
        {
          key: "testimonials",
          label: "Testimonials",
          icon: "user",
          to: "/super-admin/testimonials",
        },
        {
          key: "blogs",
          label: "Blogs CMS",
          icon: "module",
          to: "/super-admin/blogs",
        },
        {
          key: "seo_settings",
          label: "SEO & Meta Settings",
          icon: "settings",
          to: "/super-admin/seo-settings",
        },
      ],
    },
    {
      title: "SETTINGS",
      items: [
        {
          key: "system",
          label: "System",
          icon: "settings",
          children: [
            { key: "system_dev", label: "Developer Settings", to: "/super-admin/dev-settings" },
            { key: "system_logs", label: "Logs", to: "/super-admin/logs" },
            { key: "system_terminal", label: "CMD Terminal", to: "/super-admin/terminal" },
          ],
        },
        {
          key: "profile",
          label: "My Profile",
          icon: "user",
          to: "/super-admin/profile",
        },
        {
          key: "sessions",
          label: "Active Sessions",
          icon: "session",
          to: "/super-admin/sessions",
        },
        {
          key: "change_password",
          label: "Change Password",
          icon: "lock",
          to: "/super-admin/change-password",
        },
      ],
    },
  ];

  return (
    <div className="dashboard super-admin-portal">
      <Sidebar
        brandTitle="IELTS LMS"
        brandSubtitle="Super Admin"
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onLogout={handleLogout}
      />
      <main className="dashboard-content">
        <NotificationBell eyebrow="Platform updates" fallbackRoute="/super-admin/dashboard" />
        <GsapRouteAnimator>
          <Outlet />
        </GsapRouteAnimator>
      </main>
    </div>
  );
}
