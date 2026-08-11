import { create } from "zustand";

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface PageTitleState {
  itemCount: number | null;
  setItemCount: (count: number | null) => void;
  customBreadcrumbs: BreadcrumbItem[] | null;
  setCustomBreadcrumbs: (crumbs: BreadcrumbItem[] | null) => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  itemCount: null,
  setItemCount: (count) => set({ itemCount: count }),
  customBreadcrumbs: null,
  setCustomBreadcrumbs: (crumbs) => set({ customBreadcrumbs: crumbs }),
}));
