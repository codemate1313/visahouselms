import { create } from "zustand";

// Remove sessions persisted by versions that stored bearer tokens in localStorage.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("ielts-lms-auth");
}

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  institute_id: number | null;
  institute_slug: string | null;
  first_name: string;
  last_name: string;
  force_password_reset: boolean;
  avatar_url: string | null;
  institute_permissions: Record<string, boolean> | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  initialized: boolean;
  setSession: (accessToken: string, user: AuthUser) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: AuthUser) => void;
  setInitialized: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  initialized: false,
  setSession: (accessToken, user) => set({ accessToken, user, initialized: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setInitialized: () => set({ initialized: true }),
  clear: () => set({ accessToken: null, user: null, initialized: true }),
}));
