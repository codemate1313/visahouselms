import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { Sidebar, type MenuItem, type MenuSection } from "../../components/Sidebar";
import { useInstituteBranding } from "../../hooks/useInstituteBranding";
import { useAuthStore } from "../../store/authStore";

const COLLAPSE_STORAGE_KEY = "student-lms-sidebar-collapsed";

export function StudentLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clear = useAuthStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const isInstituteStudent = user?.institute_id != null;
  const { branding, logoUrl } = useInstituteBranding(isInstituteStudent ? user?.institute_slug : null);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function logout() {
    if (refreshToken) {
      try {
        await apiClient.post("/auth/logout", { refresh_token: refreshToken });
      } catch {
        /* best effort */
      }
    }
    clear();
    navigate("/login");
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
      <main className="dashboard-content" style={{ flex: 1, padding: "20px" }}>
        <Outlet />
      </main>
    </div>
  );
}
