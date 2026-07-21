import { createBrowserRouter, Navigate } from "react-router-dom";
import { Login } from "../pages/Login";
import { Register } from "../pages/Register";
import { TestingLoginSelector } from "../pages/TestingLoginSelector";
import { InstituteBilling } from "../pages/institute/InstituteBilling";
import { InstituteDashboard } from "../pages/institute/InstituteDashboard";
import { InstituteLayout } from "../pages/institute/InstituteLayout";
import { InstituteInstructorLayout } from "../pages/institute/InstituteInstructorLayout";
import { InstituteMemberForm, SuperAdminInstructorForm, SuperAdminStudentForm } from "../pages/institute/InstituteMemberForm";
import { InstituteMembers, SuperAdminInstituteAccounts, SuperAdminInstituteStudents } from "../pages/institute/InstituteMembers";
import { InstituteProfile } from "../pages/institute/InstituteProfile";
import { StudentOverview, SuperAdminStudentOverview } from "../pages/institute/StudentOverview";
import { GradingDetail } from "../pages/instructor/GradingDetail";
import { GradingQueue } from "../pages/instructor/GradingQueue";
import { InstructorDashboard } from "../pages/instructor/InstructorDashboard";
import { InstructorLayout } from "../pages/instructor/InstructorLayout";
import { InstructorProfile } from "../pages/instructor/InstructorProfile";
import { ModuleEditor } from "../pages/instructor/ModuleEditor";
import { Modules } from "../pages/instructor/Modules";
import { AttemptResult } from "../pages/student/AttemptResult";
import { CourseCatalog as StudentCourseCatalog } from "../pages/student/CourseCatalog";
import { MyCourses } from "../pages/student/MyCourses";
import { StudentAttempts } from "../pages/student/StudentAttempts";
import { StudentDashboard } from "../pages/student/StudentDashboard";
import { StudentLayout } from "../pages/student/StudentLayout";
import { StudentProfile } from "../pages/student/StudentProfile";
import { StudentProgress } from "../pages/student/StudentProgress";
import { TestRunner } from "../pages/student/TestRunner";
import { AccountForm } from "../pages/super-admin/AccountForm";
import { AccountsList } from "../pages/super-admin/AccountsList";
import { ChangePassword } from "../pages/super-admin/ChangePassword";
import { CouponForm } from "../pages/super-admin/CouponForm";
import { Coupons } from "../pages/super-admin/Coupons";
import { Dashboard } from "../pages/super-admin/Dashboard";
import { DashboardLayout } from "../pages/super-admin/DashboardLayout";
import { GradingOversight } from "../pages/super-admin/GradingOversight";
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
import { InstituteOnboarding } from "../pages/super-admin/InstituteOnboarding";
import { InstituteOnboardings } from "../pages/super-admin/InstituteOnboardings";
import { ModuleControl } from "../pages/super-admin/ModuleControl";
import { ModuleControlDetail } from "../pages/super-admin/ModuleControlDetail";
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
  { path: "/", element: <TestingLoginSelector /> },
  { path: "/testing-login", element: <TestingLoginSelector /> },
  { path: "/super-admin/login", element: <Login allowedRoles={["SUPER_ADMIN"]} title="Super Admin Login" subtitle="Sign in to the platform administration portal" wrongRoleMessage="This login is only for Super Admin accounts." /> },
  { path: "/sa-instructor/login", element: <Login allowedRoles={["SA_INSTRUCTOR"]} title="Super Admin Instructor Login" subtitle="Sign in to the assessment authoring portal" wrongRoleMessage="This login is only for Super Admin Instructor accounts." /> },
  { path: "/super-admin", element: <Navigate to="/super-admin/login" replace /> },
  { path: "/super-admin/instructor", element: <Navigate to="/super-admin/instructor/dashboard" replace /> },
  { path: "/admin-login", element: <Navigate to="/super-admin/login" replace /> },
  { path: "/sa-instructor-login", element: <Navigate to="/sa-instructor/login" replace /> },
  { path: "/instructor", element: <Navigate to="/super-admin/instructor/dashboard" replace /> },
  { path: "/instructor/*", element: <Navigate to="/super-admin/instructor/dashboard" replace /> },
  { path: "/login", element: <Login allowedRoles={["INSTITUTE_ADMIN", "INST_INSTRUCTOR", "STUDENT"]} title="Portal Login" subtitle="Sign in as institute admin, instructor, or student" wrongRoleMessage="Super Admin and SA Instructor accounts have separate login pages." /> },
  { path: "/register", element: <Register /> },
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
          { path: "modules", element: <ModuleControl /> },
          { path: "modules/:id", element: <ModuleControlDetail /> },
          { path: "grading", element: <GradingOversight /> },
          { path: "courses", element: <Navigate to="/super-admin/modules" replace /> },
          { path: "courses/:id", element: <Navigate to="/super-admin/modules" replace /> },
          { path: "profile", element: <Profile /> },
          { path: "sessions", element: <Sessions /> },
          { path: "change-password", element: <ChangePassword /> },
          { path: "dev-settings", element: <DeveloperSettings /> },
          { path: "logs", element: <Logs /> },
          { path: "terminal", element: <Terminal /> },
          { path: "onboarding", element: <InstituteOnboardings /> },
          { path: "onboarding/new", element: <InstituteOnboarding /> },
          { path: "onboarding/:id", element: <InstituteOnboarding /> },
          { path: "plans", element: <Plans /> },
          { path: "plans/new", element: <PlanForm /> },
          { path: "plans/:id", element: <PlanForm /> },
          { path: "subscriptions", element: <Subscriptions /> },
          { path: "institutes", element: <Institutes /> },
          { path: "institutes/new", element: <InstituteForm /> },
          { path: "institutes/:id", element: <InstituteForm /> },
          { path: "institutes/:id/branding", element: <InstituteBranding /> },
          { path: "institutes/:id/accounts", element: <SuperAdminInstituteAccounts /> },
          { path: "institutes/:id/accounts/students/new", element: <SuperAdminStudentForm /> },
          { path: "institutes/:id/accounts/staff/new", element: <SuperAdminInstructorForm /> },
          { path: "institutes/:id/accounts/students/:memberId", element: <SuperAdminStudentOverview /> },
          { path: "institutes/:id/accounts/students/:memberId/edit", element: <SuperAdminStudentForm /> },
          { path: "institutes/:id/accounts/staff/:memberId/edit", element: <SuperAdminInstructorForm /> },
          { path: "institutes/:id/students", element: <SuperAdminInstituteStudents /> },
          { path: "institutes/:id/students/new", element: <SuperAdminStudentForm /> },
          { path: "institutes/:id/students/:studentId", element: <SuperAdminStudentOverview /> },
          { path: "institutes/:id/students/:studentId/edit", element: <SuperAdminStudentForm /> },
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
          { path: "grading/:id", element: <GradingDetail /> },
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
      {
        path: "/institute-portal",
        element: <InstituteLayout />,
        children: [
          { index: true, element: <Navigate to="dashboard" replace /> },
          { path: "dashboard", element: <InstituteDashboard /> },
          { path: "students", element: <InstituteMembers role="STUDENT" /> },
          { path: "students/new", element: <InstituteMemberForm role="STUDENT" /> },
          { path: "students/:id", element: <StudentOverview /> },
          { path: "students/:id/edit", element: <InstituteMemberForm role="STUDENT" /> },
          { path: "staff", element: <InstituteMembers role="INST_INSTRUCTOR" /> },
          { path: "staff/new", element: <InstituteMemberForm role="INST_INSTRUCTOR" /> },
          { path: "staff/:id", element: <InstituteMemberForm role="INST_INSTRUCTOR" /> },
          { path: "billing", element: <InstituteBilling /> },
          { path: "profile", element: <InstituteProfile /> },
          { path: "sessions", element: <Sessions apiBase="/institute" /> },
          { path: "change-password", element: <ChangePassword apiBase="/institute" /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={["INST_INSTRUCTOR"]} />,
    children: [
      {
        path: "/institute-instructor",
        element: <InstituteInstructorLayout />,
        children: [
          { index: true, element: <Navigate to="grading" replace /> },
          { path: "grading", element: <GradingQueue /> },
          { path: "grading/:id", element: <GradingDetail /> },
          { path: "sessions", element: <Sessions apiBase="/institute-instructor" /> },
          { path: "change-password", element: <ChangePassword apiBase="/institute-instructor" /> },
        ],
      },
    ],
  },
  {
    element: <ProtectedRoute allowedRoles={["STUDENT"]} />,
    children: [
      {
        path: "/student",
        element: <StudentLayout />,
        children: [
          { path: "dashboard", element: <StudentDashboard /> },
          { path: "courses", element: <StudentCourseCatalog /> },
          { path: "my-courses", element: <MyCourses /> },
          { path: "attempts", element: <StudentAttempts /> },
          { path: "attempts/:id/result", element: <AttemptResult /> },
          { path: "progress", element: <StudentProgress /> },
          { path: "profile", element: <StudentProfile /> },
          { path: "sessions", element: <Sessions apiBase="/student" /> },
          { path: "change-password", element: <ChangePassword apiBase="/student" /> },
        ],
      },
      { path: "/student/attempts/:id/take", element: <TestRunner /> },
    ],
  },
]);
