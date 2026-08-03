import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "@/auth/logout";
import { GsapRouteAnimator } from "@/components/GsapRouteAnimator";
import { PortalTopBar } from "@/components/PortalTopBar";
import { Sidebar, type MenuItem, type MenuSection } from "@/components/Sidebar";
import { useInstituteBranding } from "@/hooks/useInstituteBranding";
import { useAuthStore } from "@/store/authStore";
import { useStudentAccess } from "@/hooks/useStudentAccess";
import { studentLayoutStrings as strings } from "./StudentLayout.strings";

const COLLAPSE_STORAGE_KEY = "student-lms-sidebar-collapsed";

export function StudentLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );
  const user = useAuthStore((state) => state.user);
  const isInstituteStudent = user?.institute_id != null;
  // Without a paid plan the portal is demo-only: free sample tests plus a way
  // to purchase. Everything else is hidden until a subscription is active.
  const { hasActivePlan } = useStudentAccess();
  const { branding, logoUrl } = useInstituteBranding(isInstituteStudent ? user?.institute_slug : null);
  const roleLabel = isInstituteStudent ? strings.instituteStudent : strings.directStudent;

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function logout() {
    await logoutAndRedirectHome();
  }

  const menu = strings.menu;
  const mainItems: MenuItem[] = [];
  if (hasActivePlan) {
    mainItems.push({ key: "dashboard", label: menu.dashboard, icon: "dashboard", to: "/student/dashboard" });
  }
  if (!isInstituteStudent) {
    mainItems.push({ key: "catalog", label: menu.plansAndUpgrades, icon: "courses", to: "/student/courses" });
  }
  mainItems.push(
    { key: "my-courses", label: menu.myTests, icon: "module", to: "/student/my-courses" },
    // Demo students take tests and must be able to read their results.
    { key: "attempts", label: menu.myTestHistory, icon: "grading", to: "/student/attempts" },
  );
  if (hasActivePlan) {
    mainItems.push(
      { key: "progress", label: menu.progress, icon: "analytics", to: "/student/progress" },
      { key: "news", label: menu.news, icon: "notifications", to: "/student/news" },
      { key: "vouchers", label: menu.vouchers, icon: "transactions", to: "/student/vouchers" },
    );
    if (!isInstituteStudent) {
      mainItems.push({ key: "purchase-history", label: menu.purchaseHistory, icon: "transactions", to: "/student/purchase-history" });
    }
  }

  const sections: MenuSection[] = [
    {
      title: menu.mainMenu,
      items: mainItems,
    },
  ];
  if (hasActivePlan) {
    sections.push({
      title: menu.supportSection,
      items: [
        { key: "support", label: menu.support, icon: "help", to: "/student/support" },
      ],
    });
  }
  sections.push(
    {
      title: menu.settings,
      items: [
        {
          key: "account",
          label: "Account",
          icon: "user",
          children: [
            { key: "profile", label: menu.myProfile, to: "/student/profile" },
            { key: "sessions", label: menu.activeSessions, to: "/student/sessions" },
            { key: "change-password", label: menu.changePassword, to: "/student/change-password" },
          ],
        },
      ],
    },
  );

  return (
    <div className={`dashboard student-portal${isInstituteStudent ? " institute-branded-portal" : " super-admin-portal"}`}>
      <Sidebar
        brandTitle={branding?.institute_name ?? strings.defaultBrandTitle}
        brandSubtitle={roleLabel}
        brandLogoUrl={logoUrl}
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onLogout={logout}
      />
      <main className="dashboard-content student-dashboard-content">
        <PortalTopBar
          notificationEyebrow={strings.notificationEyebrow}
          fallbackRoute="/student/dashboard"
          notificationsHref="/student/notifications"
          roleLabel={roleLabel}
        />
        <GsapRouteAnimator>
          <Outlet />
        </GsapRouteAnimator>
      </main>
    </div>
  );
}
