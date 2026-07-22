import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { shouldRedirectHomeAfterLogout } from "../auth/logoutRedirect";
import { useAuthStore } from "../store/authStore";
import { useLoaderStore } from "../store/loaderStore";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const baseURL = API_BASE_URL;

function loginPathForRole(role?: string) {
  if (role === "SUPER_ADMIN") return "/super-admin/login";
  if (role === "SA_INSTRUCTOR") return "/sa-instructor/login";
  return "/login";
}

function getEventMessage(config: InternalAxiosRequestConfig): string {
  const url = config.url ?? "";
  const method = (config.method ?? "get").toLowerCase();

  // Auth & Profile & Login
  if (url.includes("/auth/register")) return "Creating your account...";
  if (url.includes("/auth/login") || url.includes("/auth/me")) return "Signing into IELTS LMS...";
  if (url.includes("/auth/refresh")) return "Refreshing secure session...";
  if (url.includes("/upload-avatar") || url.includes("/me/avatar")) return "Uploading profile picture...";
  if (url.includes("/change-password") || url.includes("/me/profile")) return "Updating account profile...";

  // Super Admin Developer Settings & Maintenance
  if (url.includes("/dev-settings/seed")) return "Populating sample seed data...";
  if (url.includes("/dev-settings/migrate")) return "Running database migration...";
  if (url.includes("/dev-settings/clear-cache")) return "Clearing application cache...";
  if (url.includes("/dev-settings/smtp")) return "Saving SMTP mail settings...";
  if (url.includes("/dev-settings/fcm")) return "Saving Firebase FCM settings...";
  if (url.includes("/backups/run")) return "Generating database backup...";
  if (url.includes("/backups/") && url.includes("/restore")) return "Restoring database backup...";

  // Super Admin Accounts & Instructors
  if (method === "post" && url.includes("/accounts")) return "Creating super admin account...";
  if (method === "patch" && url.includes("/accounts")) return "Updating account details...";
  if (method === "post" && url.includes("/instructors")) return "Creating instructor account...";
  if (method === "patch" && url.includes("/instructors")) return "Updating instructor profile...";

  // Institutes, Subscriptions, Plans & Payments
  if (method === "post" && url.includes("/institutes")) return "Creating institute account...";
  if (method === "patch" && url.includes("/institutes")) return "Updating institute settings...";
  if (method === "post" && url.includes("/plans")) return "Saving subscription plan...";
  if (method === "post" && url.includes("/coupons")) return "Generating coupon code...";
  if (method === "post" && url.includes("/payment-methods")) return "Saving payment method...";

  // Instructor Portal - Courses, Modules, Tests & Question Banks
  if (url.includes("/exam-modules") && method === "post") return "Publishing exam module...";
  if (url.includes("/exam-modules") && (method === "put" || method === "patch")) return "Saving exam module...";
  if (url.includes("/courses") && (method === "post" || method === "put" || method === "patch")) return "Saving course content...";
  if (url.includes("/question-banks") || url.includes("/questions")) return "Processing question bank...";
  if (url.includes("/grading")) return "Updating grading queue...";

  // Student portal - checkout & test-taking
  if (url.includes("/checkout")) return "Processing your purchase...";
  if (url.includes("/attempts") && method === "post" && url.includes("/submit")) return "Submitting your answers...";
  if (url.includes("/attempts") && method === "post" && url.includes("/audio")) return "Uploading your recording...";
  if (url.includes("/attempts") && (method === "put" || method === "post")) return "Saving your progress...";
  if (url.includes("/avatar") && method === "post") return "Generating avatar video...";

  // Generic Actions
  if (method === "delete") return "Deleting record...";
  if (method === "post" && url.includes("/deactivate")) return "Deactivating account...";
  if (method === "post" && url.includes("/reactivate")) return "Reactivating account...";
  if (method === "post" && url.includes("/reset-password")) return "Resetting account password...";

  if (method === "get") return "Loading data...";

  return "Processing request...";
}

export const apiClient = axios.create({ baseURL, withCredentials: true });

// Separate instance with no interceptors, used only for the refresh call
const refreshClient = axios.create({ baseURL, withCredentials: true });

apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;
    if (token && !config.headers.has("Authorization")) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }

    if (!config.headers.has("X-Skip-Loader")) {
      const msg = getEventMessage(config);
      useLoaderStore.getState().showLoader(msg);
    }

    return config;
  },
  (error) => {
    useLoaderStore.getState().hideLoader();
    return Promise.reject(error);
  }
);

let refreshPromise: Promise<string> | null = null;
let logoutInProgress = false;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) {
    clear();
    throw new Error("No refresh token available");
  }

  try {
    const { data } = await refreshClient.post("/auth/refresh", { refresh_token: refreshToken });
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch (err) {
    clear();
    throw err;
  }
}

apiClient.interceptors.response.use(
  (response) => {
    useLoaderStore.getState().hideLoader();
    return response;
  },
  async (error: AxiosError) => {
    useLoaderStore.getState().hideLoader();

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401
      && originalRequest
      && !originalRequest._retry
      && !logoutInProgress
    ) {
      originalRequest._retry = true;
      const roleBeforeRefresh = useAuthStore.getState().user?.role;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const newAccessToken = await refreshPromise;
        originalRequest.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return apiClient(originalRequest);
      } catch {
        window.location.href = shouldRedirectHomeAfterLogout() ? "/" : loginPathForRole(roleBeforeRefresh);
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export async function revokeCurrentSession(): Promise<void> {
  logoutInProgress = true;

  try {
    if (refreshPromise) {
      await refreshPromise.catch(() => undefined);
    }

    const refreshToken = useAuthStore.getState().refreshToken;
    if (refreshToken) {
      await refreshClient.post("/auth/logout", { refresh_token: refreshToken });
    }
  } finally {
    useAuthStore.getState().clear();
    logoutInProgress = false;
  }
}
