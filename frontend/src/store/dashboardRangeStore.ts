import { create } from "zustand";

export type TimeRange = "7D" | "30D" | "90D";

interface DashboardRangeState {
  range: TimeRange;
  setRange: (range: TimeRange) => void;
}

export const useDashboardRangeStore = create<DashboardRangeState>((set) => ({
  range: "7D",
  setRange: (range) => set({ range }),
}));
