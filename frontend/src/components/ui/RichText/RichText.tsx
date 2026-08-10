import type { ReactNode } from "react";

/**
 * Parses markdown-style double asterisks (**word**) or simple HTML/CSS 
 * bold tags (<b>word</b>, <strong>word</strong>) to render highlighted text dynamically.
 */
export function renderRichText(text: string | null | undefined): ReactNode {
  if (!text) return null;

  // Split string using regex matching **bold**, <b>bold</b>, or <strong>bold</strong>
  const regex = /(\*\*.*?\*\*|<b>.*?<\/b>|<strong>.*?<\/strong>)/g;
  const parts = text.split(regex);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="highlighted-word">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("<b>") && part.endsWith("</b>")) {
      return (
        <strong key={idx} className="highlighted-word">
          {part.slice(3, -4)}
        </strong>
      );
    }
    if (part.startsWith("<strong>") && part.endsWith("</strong>")) {
      return (
        <strong key={idx} className="highlighted-word">
          {part.slice(8, -9)}
        </strong>
      );
    }
    return part;
  });
}
