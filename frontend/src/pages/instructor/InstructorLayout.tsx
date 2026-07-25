import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "../../auth/logout";
import { GsapRouteAnimator } from "../../components/GsapRouteAnimator";
import { PortalTopBar } from "../../components/PortalTopBar";
import { Sidebar, type MenuSection } from "../../components/Sidebar";
import { instructorLayoutStrings as strings } from "./InstructorLayout.strings";

const COLLAPSE_STORAGE_KEY = "instructor-lms-sidebar-collapsed";

export function InstructorLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function logout() {
    await logoutAndRedirectHome();
  }

  const sections: MenuSection[] = [
    {
      title: strings.sections.mainMenu,
      items: [
        {
          key: "dashboard",
          label: strings.items.dashboard,
          icon: "dashboard",
          to: "/super-admin/instructor/dashboard",
        },
        {
          key: "authoring",
          label: strings.items.authoring,
          icon: "module",
          children: [
            {
              key: "modules",
              label: strings.items.modules,
              to: "/super-admin/instructor/modules",
            },
            {
              key: "grading",
              label: strings.items.grading,
              to: "/super-admin/instructor/grading",
            },
          ],
        },
      ],
    },
    {
      title: strings.sections.settings,
      items: [
        {
          key: "account",
          label: strings.items.account,
          icon: "user",
          children: [
            {
              key: "profile",
              label: strings.items.profile,
              to: "/super-admin/instructor/profile",
            },
            {
              key: "sessions",
              label: strings.items.sessions,
              to: "/super-admin/instructor/sessions",
            },
            {
              key: "change-password",
              label: strings.items.changePassword,
              to: "/super-admin/instructor/change-password",
            },
          ],
        },
      ],
    },
  ];

  return (
    <div className="dashboard instructor-portal super-admin-portal">
      <Sidebar
        brandTitle={strings.brandTitle}
        brandSubtitle={strings.brandSubtitle}
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onLogout={logout}
      />
      <main className="dashboard-content" style={{ flex: 1, padding: "20px" }}>
        <PortalTopBar
          notificationEyebrow={strings.notificationEyebrow}
          fallbackRoute="/super-admin/instructor/dashboard"
          notificationsHref="/super-admin/instructor/notifications"
          roleLabel={strings.roleLabel}
        />
        <GsapRouteAnimator>
          <Outlet />
        </GsapRouteAnimator>
      </main>
    </div>
  );
}
