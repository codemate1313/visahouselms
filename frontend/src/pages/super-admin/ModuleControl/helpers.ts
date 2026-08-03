import { moduleControlStrings as strings } from "./ModuleControl.strings";
import { formatDate as formatDateShared } from "@/utils/date";

export function formatDate(dateStr?: string | null): string {
  return formatDateShared(dateStr, strings.facts.noChanges);
}

export function getModuleTypeBadge(typeStr: string) {
  const lower = typeStr.toLowerCase();
  const t = strings.moduleTypeLabels;
  if (lower.includes("listening")) return t.listening;
  if (lower.includes("reading")) return t.reading;
  if (lower.includes("writing")) return t.writing;
  if (lower.includes("speaking")) return t.speaking;
  if (lower.includes("full") || lower.includes("mock")) return t.fullMock;
  if (lower.includes("final")) return t.finalTest;
  return typeStr;
}
