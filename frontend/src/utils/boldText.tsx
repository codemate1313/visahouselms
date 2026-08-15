import type { ReactNode } from "react";

const BOLD_PATTERN = /(?:\*\*(.+?)\*\*|<b>(.+?)<\/b>|<strong>(.+?)<\/strong>)/gi;

/**
 * Renders `**word**`, `<b>word</b>` or `<strong>word</strong>` bold markers
 * as <strong> without interpreting any other unsafe HTML, so authored text can
 * highlight a single word (e.g. Reading 1A vocabulary-in-context prompts).
 */
export function renderBoldText(text: string): ReactNode {
  if (!text) return text;
  const hasMarkdownBold = text.includes("**");
  const hasHtmlBold = /<b\b|<strong\b/i.test(text);
  if (!hasMarkdownBold && !hasHtmlBold) return text;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  BOLD_PATTERN.lastIndex = 0;
  while ((match = BOLD_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const boldWord = match[1] ?? match[2] ?? match[3];
    parts.push(
      <strong key={key++} className="vh-bold-target">
        {boldWord}
      </strong>
    );
    lastIndex = BOLD_PATTERN.lastIndex;
  }
  parts.push(text.slice(lastIndex));
  return parts;
}

