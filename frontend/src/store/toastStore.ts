import { create } from "zustand";
import { dialogDefaults } from "../content/common.strings";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  showSuccess: (message, title = dialogDefaults.successTitle) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, type: "success", title, message, durationMs: 4000 }],
    }));
  },
  showError: (message, title = dialogDefaults.errorTitle) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, type: "error", title, message, durationMs: 5000 }],
    }));
  },
  showWarning: (message, title = dialogDefaults.warningTitle) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, type: "warning", title, message, durationMs: 4500 }],
    }));
  },
  showInfo: (message, title = dialogDefaults.infoTitle) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, type: "info", title, message, durationMs: 4000 }],
    }));
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () =>
    set(() => ({
      toasts: [],
    })),
}));
