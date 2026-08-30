import type { ReactNode } from "react";
import { parseRichTextBlocks, renderRichText } from "./richTextRender";
import "./RichText.css";

/*
 * The one markup dialect the authoring textareas write and the candidate-facing
 * panes read.
 *
 * Passages are stored as plain strings on the question, so formatting has to
 * travel inside the string itself. `RichTextEditor` inserts these markers and
 * this file turns them back into elements - keeping both halves here means a
 * marker can never be written that nothing knows how to render.
 *
 * Inline: **bold**, __underline__, *italic*, plus the legacy <b>/<strong>
 * tags that early modules were authored with.
 * Block: # headings, - bullets, 1. numbers, > quotes, blank line = paragraph.
 */

/** Joins the lines of one paragraph, keeping author line breaks or flowing continuously when unwrapped. */
function renderLines(lines: string[], unwrapSoftBreaks: boolean = false): ReactNode {
  if (unwrapSoftBreaks) {
    return renderRichText(lines.join(" "));
  }
  return lines.map((line, index) => (
    <span key={index}>
      {index > 0 && <br />}
      {renderRichText(line)}
    </span>
  ));
}

export interface RichTextContentProps {
  text: string | null | undefined;
  className?: string;
  unwrapSoftBreaks?: boolean;
}

/**
 * Block-level counterpart to `renderRichText`, for passages and any other field
 * long enough to carry headings, lists or more than one paragraph.
 */
export function RichTextContent({ text, className = "", unwrapSoftBreaks = false }: RichTextContentProps) {
  if (!text?.trim()) return null;
  const blocks = parseRichTextBlocks(text);
  const shouldUnwrap = Boolean(unwrapSoftBreaks || className.includes("justified"));

  return (
    <div className={`vh-rich-text ${className}`.trim()}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const Tag = (["h3", "h4", "h5"] as const)[block.level - 1];
          return <Tag key={index}>{renderRichText(block.text)}</Tag>;
        }
        if (block.kind === "bullets") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderRichText(item)}</li>)}
            </ul>
          );
        }
        if (block.kind === "numbers") {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderRichText(item)}</li>)}
            </ol>
          );
        }
        if (block.kind === "quote") {
          return <blockquote key={index}>{renderLines(block.lines, shouldUnwrap)}</blockquote>;
        }
        return <p key={index}>{renderLines(block.lines, shouldUnwrap)}</p>;
      })}
    </div>
  );
}
