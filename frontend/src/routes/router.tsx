import { createBrowserRouter, Navigate } from "react-router-dom";
import { Login } from "../pages/Login";
import { AccountForm } from "../pages/super-admin/AccountForm";
import { AccountsList } from "../pages/super-admin/AccountsList";
import { ChangePassword } from "../pages/super-admin/ChangePassword";
import { DashboardLayout } from "../pages/super-admin/DashboardLayout";
import { Profile } from "../pages/super-admin/Profile";
import { Sessions } from "../pages/super-admin/Sessions";
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
        ],
      },
    ],
  },
]);
