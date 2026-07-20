import { createBrowserRouter, Navigate } from "react-router-dom";
import { InstitutePortalComingSoon } from "../pages/InstitutePortalComingSoon";
import { Login } from "../pages/Login";
import { AccountForm } from "../pages/super-admin/AccountForm";
import { AccountsList } from "../pages/super-admin/AccountsList";
import { ChangePassword } from "../pages/super-admin/ChangePassword";
import { CouponForm } from "../pages/super-admin/CouponForm";
import { Coupons } from "../pages/super-admin/Coupons";
import { Dashboard } from "../pages/super-admin/Dashboard";
import { DashboardLayout } from "../pages/super-admin/DashboardLayout";
import { DemoAccounts } from "../pages/super-admin/DemoAccounts";
import { DeveloperSettings } from "../pages/super-admin/DeveloperSettings";
import { InstituteBranding } from "../pages/super-admin/InstituteBranding";
import { InstituteForm } from "../pages/super-admin/InstituteForm";
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
  { path: "/", element: <Navigate to="/login" replace /> },
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute allowedRoles={["SUPER_ADMIN"]} />,
    children: [
      {
        path: "/super-admin",
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Dashboard /> },
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
    element: <ProtectedRoute allowedRoles={["INSTITUTE_ADMIN"]} />,
    children: [
      { path: "/institute-portal", element: <InstitutePortalComingSoon /> },
    ],
  },
]);
