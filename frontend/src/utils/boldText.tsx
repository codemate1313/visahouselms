import type { ReactNode } from "react";

const BOLD_PATTERN = /\*\*(.+?)\*\*/g;

/**
 * Renders `**word**` markdown-style bold markers as <strong> without
 * interpreting any other HTML, so authored text can highlight a single
 * word (e.g. Reading 1A vocabulary-in-context prompts) safely.
 */
export function renderBoldText(text: string): ReactNode {
  if (!text || !text.includes("**")) return text;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  BOLD_PATTERN.lastIndex = 0;
  while ((match = BOLD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<strong key={key++}>{match[1]}</strong>);
    lastIndex = BOLD_PATTERN.lastIndex;
  }
  parts.push(text.slice(lastIndex));
  return parts;
}
