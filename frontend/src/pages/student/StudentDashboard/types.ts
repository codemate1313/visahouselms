import type { AttemptSummary, StudentPlanModule } from "@/api/types";

export interface TestProgressItem {
  module: StudentPlanModule;
  moduleId: number;
  latestAttempt: AttemptSummary | undefined;
  progress: number;
  statusLabel: string;
}
