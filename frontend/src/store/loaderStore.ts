import { create } from "zustand";

interface LoaderStore {
  isLoading: boolean;
  message: string;
  activeRequests: number;
  showLoader: (customMessage?: string) => void;
  hideLoader: () => void;
  resetLoader: () => void;
  setMessage: (msg: string) => void;
}

let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
let textCycleTimer: ReturnType<typeof setInterval> | null = null;

const DEFAULT_MESSAGES = [
  "Processing request...",
  "Syncing data with server...",
  "Finalizing changes...",
  "Almost ready...",
];

export const useLoaderStore = create<LoaderStore>((set, get) => ({
  isLoading: false,
  message: "Loading...",
  activeRequests: 0,

  showLoader: (customMessage?: string) => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (textCycleTimer) clearInterval(textCycleTimer);

    const initialMsg = customMessage || DEFAULT_MESSAGES[0];

    // Safety fallback timer: reset loader after 8s max
    timeoutTimer = setTimeout(() => {
      if (textCycleTimer) clearInterval(textCycleTimer);
      set({ activeRequests: 0, isLoading: false, message: "Loading..." });
    }, 8000);

    // Auto-cycle generic messages if no custom event message is locked
    if (!customMessage) {
      let msgIdx = 0;
      textCycleTimer = setInterval(() => {
        if (!get().isLoading) return;
        msgIdx = (msgIdx + 1) % DEFAULT_MESSAGES.length;
        set({ message: DEFAULT_MESSAGES[msgIdx] });
      }, 1600);
    }

    set((state) => ({
      activeRequests: state.activeRequests + 1,
      isLoading: true,
      message: initialMsg,
    }));
  },

  hideLoader: () => {
    set((state) => {
      const nextRequests = Math.max(0, state.activeRequests - 1);
      if (nextRequests === 0) {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (textCycleTimer) clearInterval(textCycleTimer);
        timeoutTimer = null;
        textCycleTimer = null;
      }
      return {
        activeRequests: nextRequests,
        isLoading: nextRequests > 0,
        message: nextRequests > 0 ? state.message : "Loading...",
      };
    });
  },

  resetLoader: () => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (textCycleTimer) clearInterval(textCycleTimer);
    timeoutTimer = null;
    textCycleTimer = null;
    set({ activeRequests: 0, isLoading: false, message: "Loading..." });
  },

  setMessage: (msg: string) => set({ message: msg }),
}));
