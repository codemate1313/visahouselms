import { create } from "zustand";
import type { AuthUser } from "./authStore";

/**
 * Impersonation is a token swap: the developer's real session is set aside, the
 * read-only impersonation token becomes the active one, and this store keeps
 * what is needed to put things back exactly as they were on exit. Persisted to
 * localStorage so a refresh mid-impersonation keeps the banner and the way out
 * rather than stranding the developer in someone else's view.
 *
 * The bearer tokens themselves are deliberately kept OUT of the persisted
 * state - like authStore, they never touch localStorage, where an XSS bug
 * could read them straight off disk. They live only in the module-level
 * `tokens` variable below (see getOriginalToken/getImpersonatedToken), so a
 * hard refresh clears them: initializeSession() then finds `active: true`
 * with no in-memory token, ends the stale impersonation record, and falls
 * back to the developer's own refresh-cookie session instead.
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
  originalUser: AuthUser | null;
  impersonatedUser: AuthUser | null;
  begin: (payload: {
    target: ImpersonationTarget;
    originalToken: string;
    originalUser: AuthUser;
    impersonatedToken: string;
    impersonatedUser: AuthUser;
  }) => void;
  end: () => void;
}

const STORAGE_KEY = "vh-impersonation";

// In-memory only, never part of the persisted/Zustand state - see the note
// above. Reset on both begin() and end().
let tokens: { originalToken: string | null; impersonatedToken: string | null } = {
  originalToken: null,
  impersonatedToken: null,
};

export function getOriginalToken(): string | null {
  return tokens.originalToken;
}

export function getImpersonatedToken(): string | null {
  return tokens.impersonatedToken;
}

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
          originalUser: state.originalUser,
          impersonatedUser: state.impersonatedUser,
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
  originalUser: saved.originalUser ?? null,
  impersonatedUser: saved.impersonatedUser ?? null,
  begin: ({ target, originalToken, originalUser, impersonatedToken, impersonatedUser }) => {
    tokens = { originalToken, impersonatedToken };
    set({ active: true, target, originalUser, impersonatedUser });
    persist(get());
  },
  end: () => {
    tokens = { originalToken: null, impersonatedToken: null };
    set({
      active: false,
      target: null,
      originalUser: null,
      impersonatedUser: null,
    });
    persist(get());
  },
}));
