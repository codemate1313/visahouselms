import { create } from "zustand";
import type { AuthUser } from "./authStore";

/**
 * Impersonation is a token swap: the developer's real session is set aside, the
 * read-only impersonation token becomes the active one, and this store keeps
 * what is needed to put things back exactly as they were on exit. Persisted to
 * localStorage so a refresh mid-impersonation keeps the banner and the way out
 * rather than stranding the developer in someone else's view.
 */
export interface ImpersonationTarget {
  id: number;
  name: string;
  email: string;
  role: string | null;
}

interface ImpersonationState {
  active: boolean;
  target: ImpersonationTarget | null;
  originalToken: string | null;
  originalUser: AuthUser | null;
  begin: (payload: {
    target: ImpersonationTarget;
    originalToken: string;
    originalUser: AuthUser;
  }) => void;
  end: () => void;
}

const STORAGE_KEY = "vh-impersonation";

function load(): Partial<ImpersonationState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persist(state: ImpersonationState) {
  try {
    if (state.active) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          active: true,
          target: state.target,
          originalToken: state.originalToken,
          originalUser: state.originalUser,
        }),
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* storage disabled - the banner still works for this tab */
  }
}

const saved = load();

export const useImpersonationStore = create<ImpersonationState>((set, get) => ({
  active: Boolean(saved.active),
  target: saved.target ?? null,
  originalToken: saved.originalToken ?? null,
  originalUser: saved.originalUser ?? null,
  begin: ({ target, originalToken, originalUser }) => {
    set({ active: true, target, originalToken, originalUser });
    persist(get());
  },
  end: () => {
    set({ active: false, target: null, originalToken: null, originalUser: null });
    persist(get());
  },
}));
