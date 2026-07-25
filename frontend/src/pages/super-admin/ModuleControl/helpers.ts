import { moduleControlStrings as strings } from "./ModuleControl.strings";

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return strings.facts.noChanges;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
