import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "@/auth/logout";
import { GsapRouteAnimator } from "@/components/GsapRouteAnimator";
import { PortalTopBar } from "@/components/PortalTopBar";
import { DEVELOPER_ACCESS_SLUG } from "@/config/developerAccess";
import { Sidebar, type MenuSection } from "@/components/Sidebar";

const COLLAPSE_STORAGE_KEY = "developer-lms-sidebar-collapsed";
const developerAccessSlug = DEVELOPER_ACCESS_SLUG;

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
          key: "institutes",
          label: "Institutes",
          icon: "building",
          to: `/${developerAccessSlug}/institutes`,
        },
        {
          key: "users",
          label: "Users",
          icon: "user",
          to: `/${developerAccessSlug}/users`,
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
      title: "Oversight",
      items: [
        {
          key: "analytics",
          label: "Analytics",
          icon: "analytics",
          to: `/${developerAccessSlug}/analytics`,
        },
        {
          key: "operations",
          label: "Operations",
          icon: "terminal",
          to: `/${developerAccessSlug}/operations`,
        },
        {
          key: "site-control",
          label: "Site Control",
          icon: "settings",
          to: `/${developerAccessSlug}/site-control`,
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
