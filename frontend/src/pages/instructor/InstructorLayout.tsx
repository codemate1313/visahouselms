import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { logoutAndRedirectHome } from "../../auth/logout";
import { GsapRouteAnimator } from "../../components/GsapRouteAnimator";
import { PortalTopBar } from "../../components/PortalTopBar";
import { Sidebar, type MenuSection } from "../../components/Sidebar";
import { instructorLayoutStrings as strings } from "./InstructorLayout.strings";

const COLLAPSE_STORAGE_KEY = "instructor-lms-sidebar-collapsed";
const MODULE_WORKSPACE_PATH = "/super-admin/instructor/modules";

function isModuleEditorPath(pathname: string) {
  return pathname.startsWith(`${MODULE_WORKSPACE_PATH}/new/`)
    || /^\/super-admin\/instructor\/modules\/\d+$/.test(pathname);
}

export function InstructorLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );
  const [moduleWorkspaceTarget, setModuleWorkspaceTarget] = useState(MODULE_WORKSPACE_PATH);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (location.pathname === MODULE_WORKSPACE_PATH) {
      setModuleWorkspaceTarget(MODULE_WORKSPACE_PATH);
    } else if (isModuleEditorPath(location.pathname)) {
      setModuleWorkspaceTarget(location.pathname);
    }
  }, [location.pathname]);

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
      ],
    },
    {
      title: strings.sections.authoring,
      items: [
        {
          key: "modules",
          label: strings.items.modules,
          icon: "module",
          to: moduleWorkspaceTarget,
        },
        {
          key: "grading",
          label: strings.items.grading,
          icon: "grading",
          to: "/super-admin/instructor/grading",
        },
        {
          key: "grammar-content",
          label: strings.items.grammarContent,
          icon: "filePdf",
          to: "/super-admin/instructor/grammar-content",
        },
      ],
    },

    {
      title: strings.sections.support,
      items: [
        {
          key: "support",
          label: strings.items.raiseQuery,
          icon: "help",
          to: "/super-admin/instructor/support",
        },
      ],
    },
    {
      title: strings.sections.settings,
      items: [
        {
          key: "profile",
          label: strings.items.profile,
          icon: "user",
          to: "/super-admin/instructor/profile",
        },
        {
          key: "sessions",
          label: strings.items.sessions,
          icon: "session",
          to: "/super-admin/instructor/sessions",
        },
        {
          key: "change-password",
          label: strings.items.changePassword,
          icon: "lock",
          to: "/super-admin/instructor/change-password",
        },
      ],
    },
  ];

  return (
    <div className="dashboard instructor-portal super-admin-portal">
      <Sidebar
        brandTitle={strings.brandTitle}
        brandSubtitle={strings.brandSubtitle}
        brandLogoUrl="/brand/vh-mark-96.png"
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
