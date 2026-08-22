import type { ReactNode } from "react";
import { create } from "zustand";

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface PageTitleState {
  itemCount: number | null;
  setItemCount: (count: number | null) => void;
  topBarAction: ReactNode | null;
  setTopBarAction: (action: ReactNode | null) => void;
  customBreadcrumbs: BreadcrumbItem[] | null;
  setCustomBreadcrumbs: (crumbs: BreadcrumbItem[] | null) => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  itemCount: null,
  setItemCount: (count) => set({ itemCount: count }),
  topBarAction: null,
  setTopBarAction: (action) => set({ topBarAction: action }),
  customBreadcrumbs: null,
  setCustomBreadcrumbs: (crumbs) => set({ customBreadcrumbs: crumbs }),
}));
