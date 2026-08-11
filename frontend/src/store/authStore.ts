import { create } from "zustand";

// Remove sessions persisted by versions that stored bearer tokens in localStorage.
if (typeof window !== "undefined") {
  window.localStorage.removeItem("language-cert-auth");
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
  is_owner?: boolean;
  is_developer_verified?: boolean;
  can_view_monetary_analytics?: boolean;
  dob?: string | null;
  phone_number?: string | null;
  address?: string | null;
  gender?: string | null;
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
