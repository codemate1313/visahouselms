import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "@/auth/logout";
import { GsapRouteAnimator } from "@/components/GsapRouteAnimator";
import { PortalTopBar } from "@/components/PortalTopBar";
import { Sidebar, type MenuSection } from "@/components/Sidebar";
import { dashboardLayoutStrings as strings } from "./DashboardLayout.strings";

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

  const m = strings.menu;

  const sections: MenuSection[] = [
    {
      title: m.mainMenu,
      items: [
        {
          key: "dashboard",
          label: m.dashboard,
          icon: "dashboard",
          to: "/super-admin/dashboard",
        },
        {
          key: "accounts",
          label: m.adminAccounts,
          icon: "admin",
          to: "/super-admin/accounts",
        },
        {
          key: "instructors",
          label: m.saInstructors,
          icon: "instructors",
          to: "/super-admin/instructors",
        },
        {
          key: "courses",
          label: m.courseControl,
          icon: "module",
          to: "/super-admin/modules",
        },
        {
          key: "grading-oversight",
          label: m.gradingOversight,
          icon: "grading",
          to: "/super-admin/grading",
        },
        {
          key: "notifications",
          label: m.notifications,
          icon: "notifications",
          to: "/super-admin/notifications",
        },
        {
          key: "saas",
          label: m.saas,
          icon: "building",
          children: [
            { key: "saas_institutes", label: m.saasInstitutes, to: "/super-admin/institutes" },
            { key: "saas_onboarding", label: m.saasOnboarding, to: "/super-admin/onboarding" },
            { key: "saas_plans", label: m.saasPlans, to: "/super-admin/plans" },
            { key: "saas_subscriptions", label: m.saasSubscriptions, to: "/super-admin/subscriptions" },
            { key: "saas_trial", label: m.saasTrial, to: "/super-admin/trial-config" },
            { key: "saas_demo", label: m.saasDemo, to: "/super-admin/demo-accounts" },
            { key: "saas_coupons", label: m.saasCoupons, to: "/super-admin/coupons" },
            { key: "saas_payments", label: m.saasPayments, to: "/super-admin/payments" },
            { key: "saas_payment_methods", label: m.saasPaymentMethods, to: "/super-admin/payment-methods" },
            { key: "saas_revenue", label: m.saasRevenue, to: "/super-admin/revenue" },
          ],
        },
      ],
    },
    {
      title: m.cmsContent,
      items: [
        {
          key: "testimonials",
          label: m.testimonials,
          icon: "user",
          to: "/super-admin/testimonials",
        },
        {
          key: "blogs",
          label: m.blogsCms,
          icon: "module",
          to: "/super-admin/blogs",
        },
        {
          key: "seo_settings",
          label: m.seoSettings,
          icon: "settings",
          to: "/super-admin/seo-settings",
        },
      ],
    },
    {
      title: m.settings,
      items: [
        {
          key: "system",
          label: m.system,
          icon: "settings",
          children: [
            { key: "system_dev", label: m.systemDev, to: "/super-admin/dev-settings" },
            { key: "system_logs", label: m.systemLogs, to: "/super-admin/logs" },
            { key: "system_terminal", label: m.systemTerminal, to: "/super-admin/terminal" },
          ],
        },
        {
          key: "profile",
          label: m.myProfile,
          icon: "user",
          to: "/super-admin/profile",
        },
        {
          key: "sessions",
          label: m.activeSessions,
          icon: "session",
          to: "/super-admin/sessions",
        },
        {
          key: "change_password",
          label: m.changePassword,
          icon: "lock",
          to: "/super-admin/change-password",
        },
      ],
    },
  ];

  return (
    <div className="dashboard super-admin-portal">
      <Sidebar
        brandTitle={strings.brandTitle}
        brandSubtitle={strings.brandSubtitle}
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onLogout={handleLogout}
      />
      <main className="dashboard-content">
        <PortalTopBar
          notificationEyebrow={strings.notificationEyebrow}
          fallbackRoute="/super-admin/dashboard"
          notificationsHref="/super-admin/inbox"
          roleLabel={strings.brandSubtitle}
        />
        <GsapRouteAnimator>
          <Outlet />
        </GsapRouteAnimator>
      </main>
    </div>
  );
}
