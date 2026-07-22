import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "../../auth/logout";
import { GsapRouteAnimator } from "../../components/GsapRouteAnimator";
import { Sidebar, type MenuItem, type MenuSection } from "../../components/Sidebar";
import { StudentNotificationBell } from "../../components/StudentNotificationBell";
import { useInstituteBranding } from "../../hooks/useInstituteBranding";
import { useAuthStore } from "../../store/authStore";

const COLLAPSE_STORAGE_KEY = "student-lms-sidebar-collapsed";

export function StudentLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );
  const user = useAuthStore((state) => state.user);
  const isInstituteStudent = user?.institute_id != null;
  const { branding, logoUrl } = useInstituteBranding(isInstituteStudent ? user?.institute_slug : null);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function logout() {
    await logoutAndRedirectHome();
  }

  const mainItems: MenuItem[] = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard", to: "/student/dashboard" },
  ];
  if (!isInstituteStudent) {
    mainItems.push({ key: "catalog", label: "Plans & Upgrades", icon: "courses", to: "/student/courses" });
  }
  mainItems.push(
    { key: "my-courses", label: "My Tests", icon: "module", to: "/student/my-courses" },
    { key: "attempts", label: "My Test History", icon: "grading", to: "/student/attempts" },
    { key: "progress", label: "Progress", icon: "analytics", to: "/student/progress" },
  );

  const sections: MenuSection[] = [
    {
      title: "MAIN MENU",
      items: mainItems,
    },
    {
      title: "SETTINGS",
      items: [
        { key: "profile", label: "My Profile", icon: "user", to: "/student/profile" },
        { key: "sessions", label: "Active Sessions", icon: "session", to: "/student/sessions" },
        { key: "change-password", label: "Change Password", icon: "lock", to: "/student/change-password" },
      ],
    },
  ];

  return (
    <div className={`dashboard student-portal${isInstituteStudent ? " institute-branded-portal" : ""}`}>
      <Sidebar
        brandTitle={branding?.institute_name ?? "IELTS LMS"}
        brandSubtitle={isInstituteStudent ? "Institute Student" : "Direct Student"}
        brandLogoUrl={logoUrl}
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        onLogout={logout}
      />
      <StudentNotificationBell />
      <main className="dashboard-content student-dashboard-content">
        <GsapRouteAnimator>
          <Outlet />
        </GsapRouteAnimator>
      </main>
    </div>
  );
}
