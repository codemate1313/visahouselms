import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { Sidebar, type MenuSection } from "../../components/Sidebar";
import { useAuthStore } from "../../store/authStore";

const COLLAPSE_STORAGE_KEY = "ielts-lms-sidebar-collapsed";

export function DashboardLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clear = useAuthStore((state) => state.clear);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function handleLogout() {
    if (refreshToken) {
      try {
        await apiClient.post("/auth/logout", { refresh_token: refreshToken });
      } catch {
        // best-effort
      }
    }
    clear();
    navigate("/super-admin/login");
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
    <div className="dashboard">
      <Sidebar
        brandTitle="IELTS LMS"
        brandSubtitle="Super Admin"
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onLogout={handleLogout}
      />
      <main className="dashboard-content" style={{ flex: 1, padding: "20px" }}>
        <Outlet />
      </main>
    </div>
  );
}
