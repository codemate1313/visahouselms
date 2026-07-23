import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "../../auth/logout";
import { GsapRouteAnimator } from "../../components/GsapRouteAnimator";
import { NotificationBell } from "../../components/StudentNotificationBell";
import { Sidebar, type MenuSection } from "../../components/Sidebar";
import { useInstituteBranding } from "../../hooks/useInstituteBranding";
import { useAuthStore } from "../../store/authStore";

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
    { title: "EVALUATION", items: [{ key: "grading", label: "Grading Queue", icon: "grading", to: "/institute-instructor/grading" }] },
    { title: "SETTINGS", items: [
      { key: "sessions", label: "Active Sessions", icon: "session", to: "/institute-instructor/sessions" },
      { key: "change-password", label: "Change Password", icon: "lock", to: "/institute-instructor/change-password" },
    ] },
  ];

  return <div className="dashboard instructor-portal institute-branded-portal"><Sidebar brandTitle={branding?.institute_name ?? "IELTS LMS"} brandSubtitle="Institute Instructor" brandLogoUrl={logoUrl} sections={sections} collapsed={collapsed} onToggleCollapse={() => setCollapsed((value) => !value)} onLogout={logout} /><main className="dashboard-content" style={{ flex: 1, padding: "20px" }}><NotificationBell eyebrow="Instructor updates" fallbackRoute="/institute-instructor/grading" /><GsapRouteAnimator><Outlet /></GsapRouteAnimator></main></div>;
}
