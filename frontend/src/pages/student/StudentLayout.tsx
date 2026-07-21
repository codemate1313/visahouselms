import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { Sidebar, type MenuSection } from "../../components/Sidebar";
import { useAuthStore } from "../../store/authStore";

const COLLAPSE_STORAGE_KEY = "student-lms-sidebar-collapsed";

export function StudentLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clear = useAuthStore((state) => state.clear);

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

  const sections: MenuSection[] = [
    {
      title: "MAIN MENU",
      items: [
        { key: "dashboard", label: "Dashboard", icon: "dashboard", to: "/student/dashboard" },
        { key: "catalog", label: "Course Catalog", icon: "courses", to: "/student/courses" },
        { key: "my-courses", label: "My Courses", icon: "module", to: "/student/my-courses" },
        { key: "attempts", label: "My Test History", icon: "grading", to: "/student/attempts" },
      ],
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
    <div className="dashboard student-portal">
      <Sidebar
        brandTitle="IELTS LMS"
        brandSubtitle="Student"
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
