import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "../../auth/logout";
import { GsapRouteAnimator } from "../../components/GsapRouteAnimator";
import { Sidebar, type MenuSection } from "../../components/Sidebar";

const COLLAPSE_STORAGE_KEY = "instructor-lms-sidebar-collapsed";

export function InstructorLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1"
  );

  useEffect(() => {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  async function logout() {
    await logoutAndRedirectHome();
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
        <GsapRouteAnimator>
          <Outlet />
        </GsapRouteAnimator>
      </main>
    </div>
  );
}
