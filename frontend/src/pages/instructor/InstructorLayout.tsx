import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { Sidebar, type MenuSection } from "../../components/Sidebar";
import { useAuthStore } from "../../store/authStore";

const COLLAPSE_STORAGE_KEY = "instructor-lms-sidebar-collapsed";

export function InstructorLayout() {
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
    navigate("/sa-instructor/login");
  }

  const sections: MenuSection[] = [
    {
      title: "MAIN MENU",
      items: [
        {
          key: "dashboard",
          label: "Dashboard",
          icon: "dashboard",
          to: "/super-admin/instructor/dashboard",
        },
        {
          key: "authoring",
          label: "Authoring",
          icon: "module",
          children: [
            {
              key: "modules",
              label: "Courses",
              to: "/super-admin/instructor/modules",
            },
            {
              key: "grading",
              label: "Grading Queue",
              to: "/super-admin/instructor/grading",
            },
          ],
        },
      ],
    },
    {
      title: "SETTINGS",
      items: [
        {
          key: "account",
          label: "Account",
          icon: "user",
          children: [
            {
              key: "profile",
              label: "My Profile",
              to: "/super-admin/instructor/profile",
            },
            {
              key: "sessions",
              label: "Active Sessions",
              to: "/super-admin/instructor/sessions",
            },
            {
              key: "change-password",
              label: "Change Password",
              to: "/super-admin/instructor/change-password",
            },
          ],
        },
      ],
    },
  ];

  return (
    <div className="dashboard instructor-portal">
      <Sidebar
        brandTitle="IELTS LMS"
        brandSubtitle="SA Instructor"
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
