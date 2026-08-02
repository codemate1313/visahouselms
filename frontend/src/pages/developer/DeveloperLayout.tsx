import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "@/auth/logout";
import { GsapRouteAnimator } from "@/components/GsapRouteAnimator";
import { PortalTopBar } from "@/components/PortalTopBar";
import { Sidebar, type MenuSection } from "@/components/Sidebar";

const COLLAPSE_STORAGE_KEY = "developer-lms-sidebar-collapsed";
const developerAccessSlug = import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || "vh-control-9f4c2a";

export function DeveloperLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function handleLogout() {
    await logoutAndRedirectHome();
  }

  const sections: MenuSection[] = [
    {
      title: "Developer Layer",
      items: [
        {
          key: "accounts",
          label: "Protected Accounts",
          icon: "admin",
          to: `/${developerAccessSlug}/panel`,
        },
        {
          key: "settings",
          label: "Platform Settings",
          icon: "settings",
          to: `/${developerAccessSlug}/settings`,
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          key: "change-password",
          label: "Change Password",
          icon: "lock",
          to: `/${developerAccessSlug}/change-password`,
        },
      ],
    },
  ];

  return (
    <div className="dashboard super-admin-portal developer-portal">
      <Sidebar
        brandTitle="Developer Control"
        brandSubtitle="Verified Layer"
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onLogout={handleLogout}
      />
      <main className="dashboard-content">
        <PortalTopBar
          notificationEyebrow="Developer Notifications"
          fallbackRoute={`/${developerAccessSlug}/panel`}
          notificationsHref={`/${developerAccessSlug}/notifications`}
          roleLabel="Verified Developer"
        />
        <GsapRouteAnimator>
          <Outlet />
        </GsapRouteAnimator>
      </main>
    </div>
  );
}
