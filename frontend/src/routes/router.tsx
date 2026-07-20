import { createBrowserRouter, Navigate } from "react-router-dom";
import { Login } from "../pages/Login";
import { ContentWorkspace } from "../pages/instructor/ContentWorkspace";
import { CourseEditor } from "../pages/instructor/CourseEditor";
import { Courses } from "../pages/instructor/Courses";
import { GradingQueue } from "../pages/instructor/GradingQueue";
import { InstructorDashboard } from "../pages/instructor/InstructorDashboard";
import { InstructorLayout } from "../pages/instructor/InstructorLayout";
import { InstructorProfile } from "../pages/instructor/InstructorProfile";
import { QuestionBankEditor } from "../pages/instructor/QuestionBankEditor";
import { QuestionBanks } from "../pages/instructor/QuestionBanks";
import { TestEditor } from "../pages/instructor/TestEditor";
import { Tests } from "../pages/instructor/Tests";
import { AccountForm } from "../pages/super-admin/AccountForm";
import { AccountsList } from "../pages/super-admin/AccountsList";
import { ChangePassword } from "../pages/super-admin/ChangePassword";
<<<<<<< Updated upstream
=======
import { CouponForm } from "../pages/super-admin/CouponForm";
import { CourseAssignments } from "../pages/super-admin/CourseAssignments";
import { CourseCatalog } from "../pages/super-admin/CourseCatalog";
import { Coupons } from "../pages/super-admin/Coupons";
import { Dashboard } from "../pages/super-admin/Dashboard";
>>>>>>> Stashed changes
import { DashboardLayout } from "../pages/super-admin/DashboardLayout";
import { DeveloperSettings } from "../pages/super-admin/DeveloperSettings";
<<<<<<< Updated upstream
=======
import { InstituteBranding } from "../pages/super-admin/InstituteBranding";
import { InstituteForm } from "../pages/super-admin/InstituteForm";
import { InstructorForm } from "../pages/super-admin/InstructorForm";
import { Instructors } from "../pages/super-admin/Instructors";
import { Institutes } from "../pages/super-admin/Institutes";
import { Invoice } from "../pages/super-admin/Invoice";
>>>>>>> Stashed changes
import { Logs } from "../pages/super-admin/Logs";
import { PlanForm } from "../pages/super-admin/PlanForm";
import { Plans } from "../pages/super-admin/Plans";
import { Profile } from "../pages/super-admin/Profile";
import { Subscriptions } from "../pages/super-admin/Subscriptions";
import { Sessions } from "../pages/super-admin/Sessions";
import { Terminal } from "../pages/super-admin/Terminal";
import { ProtectedRoute } from "./ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />,
    children: [
      {
        path: "/super-admin",
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="accounts" replace /> },
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
        ],
      },
    ],
  },
<<<<<<< Updated upstream
=======
  {
    element: <ProtectedRoute allowedRoles={["SA_INSTRUCTOR"]} />,
    children: [
      {
        path: "/instructor",
        element: <InstructorLayout />,
        children: [
          { index: true, element: <InstructorDashboard /> },
          { path: "workspace", element: <ContentWorkspace /> },
          { path: "courses", element: <Courses /> },
          { path: "courses/new", element: <CourseEditor /> },
          { path: "courses/:id", element: <CourseEditor /> },
          { path: "question-banks", element: <QuestionBanks /> },
          { path: "question-banks/new", element: <QuestionBankEditor /> },
          { path: "question-banks/:id", element: <QuestionBankEditor /> },
          { path: "tests", element: <Tests /> },
          { path: "tests/new", element: <TestEditor /> },
          { path: "tests/:id", element: <TestEditor /> },
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
>>>>>>> Stashed changes
]);
