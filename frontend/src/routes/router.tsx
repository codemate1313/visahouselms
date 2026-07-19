import { createBrowserRouter, Navigate } from "react-router-dom";
import { Login } from "../pages/Login";
import { AccountForm } from "../pages/super-admin/AccountForm";
import { AccountsList } from "../pages/super-admin/AccountsList";
import { ChangePassword } from "../pages/super-admin/ChangePassword";
import { DashboardLayout } from "../pages/super-admin/DashboardLayout";
import { DeveloperSettings } from "../pages/super-admin/DeveloperSettings";
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
]);
