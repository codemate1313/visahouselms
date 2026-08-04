import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "@/auth/logout";
import { GsapRouteAnimator } from "@/components/GsapRouteAnimator";
import { PortalTopBar } from "@/components/PortalTopBar";
import { Sidebar, type MenuItem, type MenuSection } from "@/components/Sidebar";
import { useInstituteBranding } from "@/hooks/useInstituteBranding";
import { useInstituteSetup } from "@/hooks/useInstituteSetup";
import { useAuthStore } from "@/store/authStore";
import { instituteLayoutStrings as strings } from "./InstituteLayout.strings";

const COLLAPSE_STORAGE_KEY = "institute-lms-sidebar-collapsed";

export function InstituteLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1",
  );
  const user = useAuthStore((state) => state.user);
  const { branding, logoUrl } = useInstituteBranding(user?.institute_slug);
  const { loading: setupLoading, needsSetup } = useInstituteSetup();
  const permissions = user?.institute_permissions ?? {};
  const canSeeStudents = Boolean(
    permissions.view_students
      || permissions.manage_students
      || permissions.view_student_activity
      || permissions.manage_student_sessions,
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function logout() {
    await logoutAndRedirectHome();
  }

  if (setupLoading) return null;

  const m = strings.menu;
  const instituteItems: MenuItem[] = [];

  if (needsSetup) {
    instituteItems.push({ key: "setup", label: m.subscription, icon: "subscription", to: "/institute-portal/setup" });
  } else {
    instituteItems.push({ key: "dashboard", label: m.dashboard, icon: "dashboard", to: "/institute-portal/dashboard" });
    if (canSeeStudents) {
      instituteItems.push({ key: "students", label: m.students, icon: "user", to: "/institute-portal/students" });
      instituteItems.push({ key: "announcements", label: m.announcements, icon: "notifications", to: "/institute-portal/announcements" });
    }
    if (permissions.manage_staff) {
      instituteItems.push({ key: "staff", label: m.instructors, icon: "instructors", to: "/institute-portal/staff" });
    }
    if (permissions.view_billing) {
      instituteItems.push({ key: "billing", label: m.subscription, icon: "subscription", to: "/institute-portal/billing" });
    }
  }

  const sections: MenuSection[] = [
    {
      title: m.institute,
      items: instituteItems,
    },
  ];

  if (!needsSetup) {
    sections.push(
      {
        title: m.supportSection,
        items: [
          { key: "support-tickets", label: m.supportTickets, icon: "notifications", to: "/institute-portal/support-tickets" },
          { key: "support", label: m.support, icon: "help", to: "/institute-portal/support" },
        ],
      },
      {
        title: m.settings,
        items: [
          {
            key: "account",
            label: "Account",
            icon: "user",
            children: [
              { key: "profile", label: m.myProfile, to: "/institute-portal/profile" },
              { key: "sessions", label: m.activeSessions, to: "/institute-portal/sessions" },
              { key: "change-password", label: m.changePassword, to: "/institute-portal/change-password" },
            ],
          },
        ],
      },
    );
  }

  return (
    <div className="dashboard institute-portal institute-branded-portal">
      <Sidebar
        brandTitle={branding?.institute_name ?? strings.brandTitle}
        brandSubtitle={strings.brandSubtitle}
        brandLogoUrl={logoUrl}
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onLogout={logout}
      />
      <main className="dashboard-content" style={{ flex: 1, padding: "20px" }}>
        <PortalTopBar
          notificationEyebrow={strings.notificationEyebrow}
          fallbackRoute="/institute-portal/dashboard"
          notificationsHref="/institute-portal/notifications"
          roleLabel={strings.roleLabel}
        />
        <GsapRouteAnimator>
          <Outlet />
        </GsapRouteAnimator>
      </main>
    </div>
  );
}
