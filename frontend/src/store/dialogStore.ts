import { create } from "zustand";
import { dialogDefaults } from "../content/common.strings";

export type DialogType = "success" | "error" | "warning" | "info";

export interface DialogOptions {
  type: DialogType;
  title?: string;
  message: string;
  confirmText?: string;
  onConfirm?: () => void;
  autoCloseMs?: number;
}

interface DialogState {
  isOpen: boolean;
  options: DialogOptions | null;
  showDialog: (options: DialogOptions) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  hideDialog: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  isOpen: false,
  options: null,
  showDialog: (options) => set({ isOpen: true, options }),
  showSuccess: (message, title = dialogDefaults.successTitle) =>
    set({ isOpen: true, options: { type: "success", title, message, autoCloseMs: 4000 } }),
  showError: (message, title = dialogDefaults.errorTitle) =>
    set({ isOpen: true, options: { type: "error", title, message, autoCloseMs: 5000 } }),
  showWarning: (message, title = dialogDefaults.warningTitle) =>
    set({ isOpen: true, options: { type: "warning", title, message, autoCloseMs: 4500 } }),
  showInfo: (message, title = dialogDefaults.infoTitle) =>
    set({ isOpen: true, options: { type: "info", title, message, autoCloseMs: 4000 } }),
  hideDialog: () => set({ isOpen: false, options: null }),
}));
