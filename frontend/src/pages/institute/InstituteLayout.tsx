import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { logoutAndRedirectHome } from "../../auth/logout";
import { GsapRouteAnimator } from "../../components/GsapRouteAnimator";
import { Sidebar, type MenuItem, type MenuSection } from "../../components/Sidebar";
import { useInstituteBranding } from "../../hooks/useInstituteBranding";
import { useAuthStore } from "../../store/authStore";

const COLLAPSE_STORAGE_KEY = "institute-lms-sidebar-collapsed";

export function InstituteLayout() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1",
  );
  const user = useAuthStore((state) => state.user);
  const { branding, logoUrl } = useInstituteBranding(user?.institute_slug);
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

  async function logout() {
    await logoutAndRedirectHome();
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
    <div className="dashboard institute-portal institute-branded-portal">
      <Sidebar
        brandTitle={branding?.institute_name ?? "IELTS LMS"}
        brandSubtitle="Institute Admin"
        brandLogoUrl={logoUrl}
        sections={sections}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((value) => !value)}
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
