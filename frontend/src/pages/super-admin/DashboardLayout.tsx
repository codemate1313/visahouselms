import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "@/auth/logout";
import { GsapRouteAnimator } from "@/components/GsapRouteAnimator";
import { PortalTopBar } from "@/components/PortalTopBar";
import { Sidebar, type MenuItem, type MenuSection } from "@/components/Sidebar";
import { useAuthStore } from "@/store/authStore";
import { dashboardLayoutStrings as strings } from "./DashboardLayout.strings";

const COLLAPSE_STORAGE_KEY = "language-cert-sidebar-collapsed";

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );
  const user = useAuthStore((state) => state.user);
  const canViewMoney = Boolean(user?.is_owner || user?.can_view_monetary_analytics);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function handleLogout() {
    await logoutAndRedirectHome();
  }

  const m = strings.menu;
  const sections = useMemo<MenuSection[]>(() => {
    const billingItems: MenuItem[] = [
      { key: "saas_plans", label: m.saasPlans, icon: "plan", to: "/super-admin/plans" },
      { key: "saas_subscriptions", label: m.saasSubscriptions, icon: "subscription", to: "/super-admin/subscriptions" },
      ...(canViewMoney
        ? [
            { key: "vouchers", label: m.vouchers, icon: "transactions" as const, to: "/super-admin/vouchers" },
            { key: "saas_coupons", label: m.saasCoupons, icon: "coupon" as const, to: "/super-admin/coupons" },
            { key: "saas_payments", label: m.saasPayments, icon: "payment" as const, to: "/super-admin/payments" },
            { key: "saas_payment_methods", label: m.saasPaymentMethods, icon: "wallet" as const, to: "/super-admin/payment-methods" },
            { key: "saas_gst_rates", label: m.saasGstRates, icon: "billings" as const, to: "/super-admin/gst-rates" },
            { key: "saas_revenue", label: m.saasRevenue, icon: "revenue" as const, to: "/super-admin/revenue" },
          ]
        : []),
      { key: "saas_trial", label: m.saasTrial, icon: "trial", to: "/super-admin/trial-config" },
    ];

    return [
      {
        key: "overview",
        title: m.overview,
        items: [
          {
            key: "dashboard",
            label: m.dashboard,
            icon: "dashboard",
            to: "/super-admin/dashboard",
          },
        ],
      },
      {
        key: "people-access",
        title: m.peopleAccess,
        collapsible: true,
        items: [
          {
            key: "users",
            label: m.users,
            icon: "admin",
            children: [
              { key: "users_super_admins", label: m.usersSuperAdmins, to: "/super-admin/users/super-admins" },
              { key: "users_sa_instructors", label: m.usersSaInstructors, to: "/super-admin/users/sa-instructors" },
              { key: "users_institute_admins", label: m.usersInstituteAdmins, to: "/super-admin/users/institute-admins" },
              { key: "users_institute_staff", label: m.usersInstituteStaff, to: "/super-admin/users/institute-staff" },
              { key: "users_students", label: m.usersStudents, to: "/super-admin/users/students" },
            ],
          },
          { key: "saas_institutes", label: m.saasInstitutes, icon: "building", to: "/super-admin/institutes" },
          { key: "saas_institute_signups", label: m.saasInstituteSignups, icon: "instructors", to: "/super-admin/institute-signups" },
        ],
      },
      {
        key: "academics",
        title: m.academics,
        collapsible: true,
        items: [
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
            key: "retake-requests",
            label: m.retakeRequests,
            icon: "restore",
            to: "/super-admin/retake-requests",
          },
        ],
      },
      {
        key: "billing-business",
        title: m.billingBusiness,
        collapsible: true,
        items: billingItems,
      },
      {
        key: "communication",
        title: m.communication,
        collapsible: true,
        items: [
          {
            key: "notifications",
            label: m.notifications,
            icon: "notifications",
            to: "/super-admin/notifications",
          },
          {
            key: "support-tickets",
            label: m.supportTickets,
            icon: "help",
            to: "/super-admin/support-tickets",
          },
        ],
      },
      {
        key: "cms-content",
        title: m.cmsContent,
        collapsible: true,
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
          {
            key: "instagram_settings",
            label: m.instagramFeed,
            icon: "play",
            to: "/super-admin/instagram-settings",
          },
        ],
      },
      {
        key: "system",
        title: m.systemSection,
        collapsible: true,
        items: [
          {
            key: "system_dev",
            label: m.systemDev,
            icon: "settings",
            to: "/super-admin/platform-settings",
          },
          { key: "system_logs", label: m.systemLogs, icon: "logs", to: "/super-admin/logs" },
          { key: "system_terminal", label: m.systemTerminal, icon: "terminal", to: "/super-admin/terminal" },
        ],
      },
      {
        key: "account",
        title: m.accountSection,
        collapsible: true,
        items: [
          {
            key: "profile",
            label: m.myProfile,
            icon: "user",
            to: "/super-admin/profile",
          },
          { key: "sessions", label: m.activeSessions, icon: "session", to: "/super-admin/sessions" },
          { key: "all_sessions", label: m.allSessions, icon: "history", to: "/super-admin/all-sessions" },
          { key: "change_password", label: m.changePassword, icon: "lock", to: "/super-admin/change-password" },
        ],
      },
    ];
  }, [canViewMoney, m]);

  return (
    <div className="dashboard super-admin-portal">
      <Sidebar
        brandTitle={strings.brandTitle}
        brandSubtitle={strings.brandSubtitle}
        brandLogoUrl="/brand/vh-mark-96.png"
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
