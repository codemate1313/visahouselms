import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "@/auth/logout";
import { GsapRouteAnimator } from "@/components/GsapRouteAnimator";
import { PortalTopBar } from "@/components/PortalTopBar";
import { Sidebar, type MenuSection } from "@/components/Sidebar";
import { useInstituteBranding } from "@/hooks/useInstituteBranding";
import { useAuthStore } from "@/store/authStore";
import { instituteInstructorLayoutStrings as strings } from "./InstituteInstructorLayout.strings";

const COLLAPSE_STORAGE_KEY = "institute-instructor-sidebar-collapsed";

export function InstituteInstructorLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  const user = useAuthStore((state) => state.user);
  const { branding, logoUrl } = useInstituteBranding(user?.institute_slug);

  useEffect(() => localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0"), [collapsed]);

  async function logout() {
    await logoutAndRedirectHome();
  }

  const sections: MenuSection[] = [
    { title: strings.menu.evaluation, items: [{ key: "grading", label: strings.menu.grading, icon: "grading", to: "/institute-instructor/grading" }] },
    { title: strings.menu.settings, items: [
      { key: "sessions", label: strings.menu.activeSessions, icon: "session", to: "/institute-instructor/sessions" },
      { key: "change-password", label: strings.menu.changePassword, icon: "lock", to: "/institute-instructor/change-password" },
    ] },
  ];

  return (
    <div className="dashboard instructor-portal institute-branded-portal">
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
          fallbackRoute="/institute-instructor/grading"
          notificationsHref="/institute-instructor/notifications"
          roleLabel={strings.roleLabel}
        />
        <GsapRouteAnimator>
          <Outlet />
        </GsapRouteAnimator>
      </main>
    </div>
  );
}
