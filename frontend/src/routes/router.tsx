import { createBrowserRouter, Navigate } from "react-router-dom";
import { InstitutePortalComingSoon } from "../pages/InstitutePortalComingSoon";
import { Login } from "../pages/Login";
import { GradingQueue } from "../pages/instructor/GradingQueue";
import { InstructorDashboard } from "../pages/instructor/InstructorDashboard";
import { InstructorLayout } from "../pages/instructor/InstructorLayout";
import { InstructorProfile } from "../pages/instructor/InstructorProfile";
import { ModuleEditor } from "../pages/instructor/ModuleEditor";
import { Modules } from "../pages/instructor/Modules";
import { AccountForm } from "../pages/super-admin/AccountForm";
import { AccountsList } from "../pages/super-admin/AccountsList";
import { ChangePassword } from "../pages/super-admin/ChangePassword";
import { CouponForm } from "../pages/super-admin/CouponForm";
import { CourseAssignments } from "../pages/super-admin/CourseAssignments";
import { CourseCatalog } from "../pages/super-admin/CourseCatalog";
import { Coupons } from "../pages/super-admin/Coupons";
import { Dashboard } from "../pages/super-admin/Dashboard";
import { DashboardLayout } from "../pages/super-admin/DashboardLayout";
import { DemoAccounts } from "../pages/super-admin/DemoAccounts";
import { DeveloperSettings } from "../pages/super-admin/DeveloperSettings";
import { InstituteBranding } from "../pages/super-admin/InstituteBranding";
import { InstituteForm } from "../pages/super-admin/InstituteForm";
import { InstructorForm } from "../pages/super-admin/InstructorForm";
import { Instructors } from "../pages/super-admin/Instructors";
import { Institutes } from "../pages/super-admin/Institutes";
import { Invoice } from "../pages/super-admin/Invoice";
import { Logs } from "../pages/super-admin/Logs";
import { PaymentMethods } from "../pages/super-admin/PaymentMethods";
import { PlanForm } from "../pages/super-admin/PlanForm";
import { Plans } from "../pages/super-admin/Plans";
import { Payments } from "../pages/super-admin/Payments";
import { Profile } from "../pages/super-admin/Profile";
import { RevenueDashboard } from "../pages/super-admin/RevenueDashboard";
import { Sessions } from "../pages/super-admin/Sessions";
import { Subscriptions } from "../pages/super-admin/Subscriptions";
import { Terminal } from "../pages/super-admin/Terminal";
import { TrialConfig } from "../pages/super-admin/TrialConfig";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/super-admin/login" replace /> },
  { path: "/super-admin/login", element: <Login allowedRoles={["SUPER_ADMIN"]} title="Super Admin Login" subtitle="Sign in to the platform administration portal" wrongRoleMessage="This login is only for Super Admin accounts." /> },
  { path: "/sa-instructor/login", element: <Login allowedRoles={["SA_INSTRUCTOR"]} title="Super Admin Instructor Login" subtitle="Sign in to the assessment authoring portal" wrongRoleMessage="This login is only for Super Admin Instructor accounts." /> },
  { path: "/super-admin", element: <Navigate to="/super-admin/login" replace /> },
  { path: "/super-admin/instructor", element: <Navigate to="/super-admin/instructor/dashboard" replace /> },
  { path: "/admin-login", element: <Navigate to="/super-admin/login" replace /> },
  { path: "/sa-instructor-login", element: <Navigate to="/sa-instructor/login" replace /> },
  { path: "/instructor", element: <Navigate to="/super-admin/instructor/dashboard" replace /> },
  { path: "/instructor/*", element: <Navigate to="/super-admin/instructor/dashboard" replace /> },
  { path: "/login", element: <Login allowedRoles={["INSTITUTE_ADMIN", "INST_INSTRUCTOR", "STUDENT"]} title="Portal Login" subtitle="Sign in as institute admin, instructor, or student" wrongRoleMessage="Super Admin and SA Instructor accounts have separate login pages." /> },
  {
    element: <ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />,
    children: [
      {
        path: "/super-admin",
        element: <DashboardLayout />,
        children: [
          { path: "dashboard", element: <Dashboard /> },
          { path: "accounts", element: <AccountsList /> },
          { path: "accounts/new", element: <AccountForm /> },
          { path: "accounts/:id", element: <AccountForm /> },
          { path: "instructors", element: <Instructors /> },
          { path: "instructors/new", element: <InstructorForm /> },
          { path: "instructors/:id", element: <InstructorForm /> },
          { path: "courses", element: <CourseCatalog /> },
          { path: "courses/:id", element: <CourseAssignments /> },
          { path: "profile", element: <Profile /> },
          { path: "sessions", element: <Sessions /> },
          { path: "change-password", element: <ChangePassword /> },
          { path: "dev-settings", element: <DeveloperSettings /> },
          { path: "logs", element: <Logs /> },
          { path: "terminal", element: <Terminal /> },
          { path: "plans", element: <Plans /> },
          { path: "plans/new", element: <PlanForm /> },
          { path: "plans/:id", element: <PlanForm /> },
          { path: "subscriptions", element: <Subscriptions /> },
          { path: "institutes", element: <Institutes /> },
          { path: "institutes/new", element: <InstituteForm /> },
          { path: "institutes/:id", element: <InstituteForm /> },
          { path: "institutes/:id/branding", element: <InstituteBranding /> },
          { path: "trial-config", element: <TrialConfig /> },
          { path: "demo-accounts", element: <DemoAccounts /> },
          { path: "coupons", element: <Coupons /> },
          { path: "coupons/new", element: <CouponForm /> },
          { path: "coupons/:id", element: <CouponForm /> },
          { path: "payments", element: <Payments /> },
          { path: "payments/:id/invoice", element: <Invoice /> },
          { path: "payment-methods", element: <PaymentMethods /> },
          { path: "revenue", element: <RevenueDashboard /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={["SA_INSTRUCTOR"]} />,
    children: [
      {
        path: "/super-admin/instructor",
        element: <InstructorLayout />,
        children: [
          { path: "dashboard", element: <InstructorDashboard /> },
          { path: "workspace", element: <Navigate to="/super-admin/instructor/modules" replace /> },
          { path: "modules", element: <Modules /> },
          { path: "modules/new/:type", element: <ModuleEditor /> },
          { path: "modules/:id", element: <ModuleEditor /> },
          { path: "courses/*", element: <Navigate to="/super-admin/instructor/modules" replace /> },
          { path: "question-banks/*", element: <Navigate to="/super-admin/instructor/modules" replace /> },
          { path: "tests/*", element: <Navigate to="/super-admin/instructor/modules" replace /> },
          { path: "grading", element: <GradingQueue /> },
          { path: "profile", element: <InstructorProfile /> },
          { path: "sessions", element: <Sessions apiBase="/instructor" /> },
          { path: "change-password", element: <ChangePassword apiBase="/instructor" /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={["INSTITUTE_ADMIN"]} />,
    children: [
      { path: "/institute-portal", element: <InstitutePortalComingSoon /> },
    ],
  },
]);
