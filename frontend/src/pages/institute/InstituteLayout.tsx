import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { Sidebar, type MenuItem, type MenuSection } from "../../components/Sidebar";
import { useAuthStore } from "../../store/authStore";

const COLLAPSE_STORAGE_KEY = "institute-lms-sidebar-collapsed";

export function InstituteLayout() {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1",
  );
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const permissions = user?.institute_permissions ?? {};
  const canSeeStudents = Boolean(
    permissions.view_students
      || permissions.manage_students
      || permissions.view_student_activity
      || permissions.manage_student_sessions,
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (!user?.institute_slug) return;
    apiClient.get(`/institutes/${user.institute_slug}/branding`).then(({ data }) => {
      document.documentElement.style.setProperty("--institute-primary", data.primary_color);
      document.documentElement.style.setProperty("--institute-secondary", data.secondary_color);
    }).catch(() => undefined);
    return () => {
      document.documentElement.style.removeProperty("--institute-primary");
      document.documentElement.style.removeProperty("--institute-secondary");
    };
  }, [user?.institute_slug]);

  async function logout() {
    if (refreshToken) {
      try {
        await apiClient.post("/auth/logout", { refresh_token: refreshToken });
      } catch {
        // Best effort logout.
      }
    }
    clear();
    navigate("/login");
  }

  const instituteItems: MenuItem[] = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard", to: "/institute-portal/dashboard" },
  ];
  if (canSeeStudents) {
    instituteItems.push({ key: "students", label: "Students", icon: "user", to: "/institute-portal/students" });
  }
  if (permissions.manage_staff) {
    instituteItems.push({ key: "staff", label: "Instructors", icon: "instructors", to: "/institute-portal/staff" });
  }
  if (permissions.view_billing) {
    instituteItems.push({ key: "billing", label: "Subscription", icon: "subscription", to: "/institute-portal/billing" });
  }

  const sections: MenuSection[] = [
    {
      title: "INSTITUTE",
      items: instituteItems,
    },
    {
      title: "SETTINGS",
      items: [
        { key: "profile", label: "My Profile", icon: "user", to: "/institute-portal/profile" },
        { key: "sessions", label: "Active Sessions", icon: "session", to: "/institute-portal/sessions" },
        { key: "change-password", label: "Change Password", icon: "lock", to: "/institute-portal/change-password" },
      ],
    },
  ];

  return (
    <div className="dashboard institute-portal">
      <Sidebar
        brandTitle="IELTS LMS"
        brandSubtitle="Institute Admin"
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
        onLogout={logout}
      />
      <main className="dashboard-content" style={{ flex: 1, padding: "20px" }}>
        <Outlet />
      </main>
    </div>
  );
}
