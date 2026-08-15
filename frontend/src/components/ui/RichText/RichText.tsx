import type { ReactNode } from "react";
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

/* Longest markers first: the leftmost-first alternation is what stops `**bold**`
   from being read as an empty italic followed by stray text. */
const INLINE_PATTERN = new RegExp(
  [
    "\\*\\*[\\s\\S]+?\\*\\*",
    "__[\\s\\S]+?__",
    "<strong>[\\s\\S]*?</strong>",
    "<b>[\\s\\S]*?</b>",
    "<em>[\\s\\S]*?</em>",
    "<i>[\\s\\S]*?</i>",
    "<u>[\\s\\S]*?</u>",
    /* Italic is * only. A lone _ is not a marker here because snake_case_words
       are ordinary passage content and would otherwise italicise themselves.
       The * has to hug its text on both sides so that "5 * 3" survives too. */
    "\\*(?![\\s*])[^*\\n]*[^\\s*]\\*",
  ].map((source) => `(?:${source})`).join("|"),
  "g",
);

/* `String.split` only keeps the separators when the pattern captures, so the
   splitting copy wraps the alternation in a group the matcher does not need. */
const INLINE_SPLIT_PATTERN = new RegExp(`(${INLINE_PATTERN.source})`, "g");

/** Strips every formatting marker - for counts, exports and plain-text compares. */
export function stripRichTextMarkers(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<\/?(?:b|strong|em|i|u)>/g, "")
    .replace(/(\*\*|__|\*)/g, "")
    .replace(/^\s{0,3}(?:#{1,3}\s+|[-*]\s+|\d+\.\s+|>\s?)/gm, "");
}

function unwrap(part: string): { inner: string; tag: "strong" | "em" | "u" } | null {
  if (part.startsWith("**") && part.endsWith("**")) return { inner: part.slice(2, -2), tag: "strong" };
  if (part.startsWith("__") && part.endsWith("__")) return { inner: part.slice(2, -2), tag: "u" };
  if (part.startsWith("<strong>")) return { inner: part.slice(8, -9), tag: "strong" };
  if (part.startsWith("<b>")) return { inner: part.slice(3, -4), tag: "strong" };
  if (part.startsWith("<em>")) return { inner: part.slice(4, -5), tag: "em" };
  if (part.startsWith("<i>")) return { inner: part.slice(3, -4), tag: "em" };
  if (part.startsWith("<u>")) return { inner: part.slice(3, -4), tag: "u" };
  if (part.startsWith("*") && part.endsWith("*")) return { inner: part.slice(1, -1), tag: "em" };
  return null;
}

/**
 * Renders the inline markers of a single run of text.
 *
 * Depth-limited rather than unbounded so that a passage full of stray asterisks
 * costs a few passes instead of recursing per character.
 */
export function renderRichText(text: string | null | undefined, depth = 0): ReactNode {
  if (!text) return null;
  if (depth > 3) return text;

  const parts = text.split(INLINE_SPLIT_PATTERN).filter((part) => part !== undefined && part !== "");

  return parts.map((part, index) => {
    const match = unwrap(part);
    if (!match) return part;
    const children = renderRichText(match.inner, depth + 1);
    if (match.tag === "strong") {
      return <strong key={index} className="highlighted-word">{children}</strong>;
    }
    if (match.tag === "em") return <em key={index}>{children}</em>;
    return <u key={index}>{children}</u>;
  });
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "bullets"; items: string[] }
  | { kind: "numbers"; items: string[] }
  | { kind: "paragraph"; lines: string[] };

const HEADING = /^\s{0,3}(#{1,3})\s+(.*)$/;
const BULLET = /^\s{0,3}[-*]\s+(.*)$/;
const NUMBER = /^\s{0,3}\d+[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let open: Block | null = null;

  const close = () => {
    if (open) blocks.push(open);
    open = null;
  };

  for (const line of text.split("\n")) {
    if (!line.trim()) {
      close();
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      close();
      blocks.push({ kind: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      if (open?.kind !== "bullets") close();
      if (open?.kind === "bullets") open.items.push(bullet[1]);
      else open = { kind: "bullets", items: [bullet[1]] };
      continue;
    }

    const numbered = NUMBER.exec(line);
    if (numbered) {
      if (open?.kind !== "numbers") close();
      if (open?.kind === "numbers") open.items.push(numbered[1]);
      else open = { kind: "numbers", items: [numbered[1]] };
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      if (open?.kind !== "quote") close();
      if (open?.kind === "quote") open.lines.push(quote[1]);
      else open = { kind: "quote", lines: [quote[1]] };
      continue;
    }

    if (open?.kind !== "paragraph") close();
    if (open?.kind === "paragraph") open.lines.push(line);
    else open = { kind: "paragraph", lines: [line] };
  }

  close();
  return blocks;
}

/** Joins the lines of one paragraph, keeping the author's line breaks. */
function renderLines(lines: string[]): ReactNode {
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
}

/**
 * Block-level counterpart to `renderRichText`, for passages and any other field
 * long enough to carry headings, lists or more than one paragraph.
 */
export function RichTextContent({ text, className = "" }: RichTextContentProps) {
  if (!text?.trim()) return null;
  const blocks = parseBlocks(text);

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
          return <blockquote key={index}>{renderLines(block.lines)}</blockquote>;
        }
        return <p key={index}>{renderLines(block.lines)}</p>;
      })}
    </div>
  );
}
