import { create } from "zustand";

interface PageTitleState {
  itemCount: number | null;
  setItemCount: (count: number | null) => void;
}

export const usePageTitleStore = create<PageTitleState>((set) => ({
  itemCount: null,
  setItemCount: (count) => set({ itemCount: count }),
}));
