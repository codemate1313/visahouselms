import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { RichTextContent } from "../RichText/RichText";
import "./RichTextEditor.css";

/**
 * A textarea with formatting controls, for passages and paragraphs.
 *
 * It stays a textarea rather than becoming a contentEditable surface: passages
 * are stored as plain strings, other tooling reads them as text (blank markers,
 * TTS scripts, imports), and every caller here already drives the raw value -
 * `SharedPassagePanel` and `GapTaskComposer` splice `{{blank:N}}` in at the
 * cursor through the forwarded ref, which a WYSIWYG surface would break.
 *
 * The buttons therefore write markers into the string, and `RichTextContent`
 * renders them wherever the passage is shown. Preview is built in so an author
 * can check the result without leaving the field.
 */

export interface RichTextEditorProps {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
  /** Read-only mirrors the textarea attribute and hides the controls. */
  readOnly?: boolean;
  required?: boolean;
  "aria-label"?: string;
  /** Panel-specific buttons (Insert Gap, and so on) shown after the format controls. */
  toolbarExtras?: ReactNode;
  /** Hides the toolbar for fields that only want the preview affordance. */
  hideToolbar?: boolean;
  style?: CSSProperties;
}

type Wrap = { marker: string; label: string; title: string; glyph: ReactNode };

const WRAPS: Wrap[] = [
  { marker: "**", label: "Bold", title: "Bold (Ctrl+B)", glyph: <span className="vh-rte-glyph is-bold">B</span> },
  { marker: "*", label: "Italic", title: "Italic (Ctrl+I)", glyph: <span className="vh-rte-glyph is-italic">I</span> },
  { marker: "__", label: "Underline", title: "Underline (Ctrl+U)", glyph: <span className="vh-rte-glyph is-underline">U</span> },
];

const BulletIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <circle cx="2.5" cy="4" r="1.4" fill="currentColor" />
    <circle cx="2.5" cy="8" r="1.4" fill="currentColor" />
    <circle cx="2.5" cy="12" r="1.4" fill="currentColor" />
    <path d="M6 4h8M6 8h8M6 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const NumberIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <text x="0" y="5.6" fontSize="5.2" fill="currentColor" fontWeight="700">1</text>
    <text x="0" y="10.2" fontSize="5.2" fill="currentColor" fontWeight="700">2</text>
    <text x="0" y="14.8" fontSize="5.2" fill="currentColor" fontWeight="700">3</text>
    <path d="M6 4h8M6 8.6h8M6 13.2h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const QuoteIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path
      d="M6.2 3.5C4.2 4.4 3 6 3 8.1V12.5h4.4V8.1H5.2c0-1.4.5-2.4 1.7-3.1zm7 0C11.2 4.4 10 6 10 8.1V12.5h4.4V8.1h-2.2c0-1.4.5-2.4 1.7-3.1z"
      fill="currentColor"
    />
  </svg>
);

const ClearIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M6 3h7M9.5 3l-3 10M3 13h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M11 9.5l3.5 3.5M14.5 9.5L11 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const LINE_PREFIX = /^(\s*)(?:#{1,3}\s+|[-*]\s+|\d+[.)]\s+|>\s?)?/;

export const RichTextEditor = forwardRef<HTMLTextAreaElement, RichTextEditorProps>(function RichTextEditor(
  {
    value,
    onChange,
    id,
    rows = 10,
    placeholder,
    className = "",
    readOnly = false,
    required = false,
    toolbarExtras,
    hideToolbar = false,
    style,
    ...rest
  },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  /* A callback ref rather than `useImperativeHandle`, because previewing
     unmounts the textarea: a cached handle would leave callers such as
     `insertBlank` splicing text into a detached element after the toggle. */
  const attachRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  /* Every control writes through here so the caret always lands where the author
     expects it to - React re-renders from `value`, which otherwise drops the
     selection to the end of the field on each edit. */
  const commit = useCallback(
    (next: string, selectionStart: number, selectionEnd: number) => {
      onChange(next);
      requestAnimationFrame(() => {
        const el = innerRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(selectionStart, selectionEnd);
      });
    },
    [onChange],
  );

  const toggleWrap = useCallback(
    (marker: string) => {
      const el = innerRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      const before = el.value.slice(0, start);
      const after = el.value.slice(end);
      const selected = el.value.slice(start, end);
      const size = marker.length;

      /* Selecting the text *inside* the markers and selecting the markers too
         are both natural ways to ask for "un-bold this", so accept either. */
      const wrappedInside =
        selected.startsWith(marker) && selected.endsWith(marker) && selected.length > size * 2;
      if (wrappedInside) {
        const inner = selected.slice(size, -size);
        commit(`${before}${inner}${after}`, start, start + inner.length);
        return;
      }
      const wrappedOutside = before.endsWith(marker) && after.startsWith(marker) && selected.length > 0;
      if (wrappedOutside) {
        const next = `${before.slice(0, -size)}${selected}${after.slice(size)}`;
        commit(next, start - size, start - size + selected.length);
        return;
      }

      if (!selected) {
        /* No selection: drop an empty pair and park the caret between them. */
        const next = `${before}${marker}${marker}${after}`;
        commit(next, start + size, start + size);
        return;
      }
      const next = `${before}${marker}${selected}${marker}${after}`;
      commit(next, start + size, start + size + selected.length);
    },
    [commit],
  );

  const applyLinePrefix = useCallback(
    (build: (index: number) => string) => {
      const el = innerRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? start;
      const lineStart = el.value.lastIndexOf("\n", start - 1) + 1;
      const lineEndIndex = el.value.indexOf("\n", end);
      const lineEnd = lineEndIndex === -1 ? el.value.length : lineEndIndex;

      const lines = el.value.slice(lineStart, lineEnd).split("\n");
      /* Blank lines inside the selection keep their place but are not numbered,
         so "1." always lands on the first line that actually has text. */
      const contentIndexes = new Map<number, number>();
      lines.forEach((line, index) => {
        if (line.trim()) contentIndexes.set(index, contentIndexes.size);
      });

      /* A second click on the same control clears it, so the buttons read as
         toggles rather than as a way to stack prefixes on one line. */
      const alreadyApplied = lines.every((line, index) => {
        if (!line.trim()) return true;
        return line.trimStart().startsWith(build(contentIndexes.get(index) ?? 0));
      });

      const block = lines
        .map((line, index) => {
          if (!line.trim()) return line;
          const stripped = line.replace(LINE_PREFIX, "$1");
          if (alreadyApplied) return stripped;
          return stripped.replace(/^(\s*)/, `$1${build(contentIndexes.get(index) ?? 0)}`);
        })
        .join("\n");

      commit(
        `${el.value.slice(0, lineStart)}${block}${el.value.slice(lineEnd)}`,
        lineStart,
        lineStart + block.length,
      );
    },
    [commit],
  );

  const clearFormatting = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const hasSelection = end > start;
    const target = hasSelection ? el.value.slice(start, end) : el.value;
    const cleaned = target
      .replace(/<\/?(?:b|strong|em|i|u)>/g, "")
      .replace(/(\*\*|__)/g, "")
      .replace(/(^|[^\w*])\*([^*\n]+)\*(?=$|[^\w*])/g, "$1$2")
      .replace(/^(\s*)(?:#{1,3}\s+|[-*]\s+|\d+[.)]\s+|>\s?)/gm, "$1");

    if (hasSelection) {
      commit(`${el.value.slice(0, start)}${cleaned}${el.value.slice(end)}`, start, start + cleaned.length);
      return;
    }
    commit(cleaned, cleaned.length, cleaned.length);
  }, [commit]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (readOnly || !(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    const marker = key === "b" ? "**" : key === "i" ? "*" : key === "u" ? "__" : null;
    if (!marker) return;
    event.preventDefault();
    toggleWrap(marker);
  }

  const controlsVisible = !hideToolbar && !readOnly;

  return (
    <div className={`vh-rte ${readOnly ? "is-readonly" : ""}`.trim()}>
      {(controlsVisible || toolbarExtras) && (
        <div className="vh-rte-toolbar" role="toolbar" aria-label="Text formatting">
          {controlsVisible && (
            <>
              <div className="vh-rte-group">
                {WRAPS.map((wrap) => (
                  <button
                    key={wrap.marker}
                    type="button"
                    className="vh-rte-button"
                    title={wrap.title}
                    aria-label={wrap.label}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggleWrap(wrap.marker)}
                  >
                    {wrap.glyph}
                  </button>
                ))}
              </div>

              <div className="vh-rte-group">
                {([1, 2] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    className="vh-rte-button"
                    title={`Heading ${level}`}
                    aria-label={`Heading ${level}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyLinePrefix(() => `${"#".repeat(level)} `)}
                  >
                    <span className="vh-rte-glyph is-heading">H{level}</span>
                  </button>
                ))}
              </div>

              <div className="vh-rte-group">
                <button
                  type="button"
                  className="vh-rte-button"
                  title="Bulleted list"
                  aria-label="Bulleted list"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyLinePrefix(() => "- ")}
                >
                  <BulletIcon />
                </button>
                <button
                  type="button"
                  className="vh-rte-button"
                  title="Numbered list"
                  aria-label="Numbered list"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyLinePrefix((index) => `${index + 1}. `)}
                >
                  <NumberIcon />
                </button>
                <button
                  type="button"
                  className="vh-rte-button"
                  title="Quote"
                  aria-label="Quote"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyLinePrefix(() => "> ")}
                >
                  <QuoteIcon />
                </button>
              </div>

              <div className="vh-rte-group">
                <button
                  type="button"
                  className="vh-rte-button"
                  title="Clear formatting from the selection"
                  aria-label="Clear formatting"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={clearFormatting}
                >
                  <ClearIcon />
                </button>
              </div>
            </>
          )}

          {toolbarExtras}

          <button
            type="button"
            className={`vh-rte-button vh-rte-preview-toggle ${showPreview ? "is-active" : ""}`.trim()}
            aria-pressed={showPreview}
            onClick={() => setShowPreview((previous) => !previous)}
          >
            {showPreview ? "Edit" : "Preview"}
          </button>
        </div>
      )}

      <textarea
        {...rest}
        ref={attachRef}
        id={id}
        className={`vh-rte-textarea ${className}`.trim()}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        style={style}
      />
      {showPreview && (
        <div className="vh-rte-preview-wrapper">
          <div className="vh-rte-preview-label">Live Preview</div>
          <div className="vh-rte-preview" style={{ minHeight: "60px", ...style }}>
            {value.trim() ? (
              <RichTextContent text={value} />
            ) : (
              <p className="vh-rte-preview-empty">Nothing to preview yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
