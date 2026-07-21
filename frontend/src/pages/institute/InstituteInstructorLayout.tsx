import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { Sidebar, type MenuSection } from "../../components/Sidebar";
import { useInstituteBranding } from "../../hooks/useInstituteBranding";
import { useAuthStore } from "../../store/authStore";

const COLLAPSE_STORAGE_KEY = "institute-instructor-sidebar-collapsed";

export function InstituteInstructorLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clear = useAuthStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const { branding, logoUrl } = useInstituteBranding(user?.institute_slug);

  useEffect(() => localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0"), [collapsed]);

  async function logout() {
    if (refreshToken) {
      try { await apiClient.post("/auth/logout", { refresh_token: refreshToken }); } catch { /* best effort */ }
    }
    clear();
    navigate("/");
  }

  const sections: MenuSection[] = [
    { title: "EVALUATION", items: [{ key: "grading", label: "Grading Queue", icon: "grading", to: "/institute-instructor/grading" }] },
    { title: "SETTINGS", items: [
      { key: "sessions", label: "Active Sessions", icon: "session", to: "/institute-instructor/sessions" },
      { key: "change-password", label: "Change Password", icon: "lock", to: "/institute-instructor/change-password" },
    ] },
  ];

  return <div className="dashboard instructor-portal institute-branded-portal"><Sidebar brandTitle={branding?.institute_name ?? "IELTS LMS"} brandSubtitle="Institute Instructor" brandLogoUrl={logoUrl} sections={sections} collapsed={collapsed} onToggleCollapse={() => setCollapsed((value) => !value)} onLogout={logout} /><main className="dashboard-content" style={{ flex: 1, padding: "20px" }}><Outlet /></main></div>;
}
