import type { AttemptSummary, ExamModuleType } from "@/api/types";
import { studentDashboardStrings as strings } from "./StudentDashboard.strings";
import { formatDate } from "@/utils/date";

export const COMPLETED_STATUSES = new Set(["submitted", "grading", "graded"]);

const MODULE_TONE: Record<ExamModuleType, string> = {
  reading: "blue",
  writing: "purple",
  listening: "emerald",
  speaking: "amber",
  full_mock: "primary",
  final_test: "slate",
};

export function moduleTone(type: string) {
  return MODULE_TONE[type as ExamModuleType] ?? "slate";
}

export function statusTone(status: string) {
  if (status === "graded") return "success";
  if (status === "grading" || status === "submitted") return "warning";
  if (status === "ready" || status === "in_progress") return "info";
  return "muted";
}

export function attemptTime(attempt: AttemptSummary) {
  return new Date(attempt.submitted_at ?? attempt.started_at).getTime();
}

export function formatAttemptDate(attempt: AttemptSummary) {
  const value = attempt.submitted_at ?? attempt.started_at;
  if (!value) return strings.notStarted;
  return formatDate(value);
}

export function progressForStatus(status?: string) {
  if (!status) return 0;
  if (status === "ready") return 15;
  if (status === "in_progress") return 45;
  if (status === "submitted" || status === "grading") return 80;
  if (status === "graded") return 100;
  if (status === "expired") return 100;
  return 0;
}

export function statusLabel(status: string): string {
  const labels = strings.statusLabels;
  return labels[status as keyof typeof labels] ?? status;
}
