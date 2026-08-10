const BLANK_MARKER = /\{\{blank:(\d+)\}\}/g;

export type ClozeToken =
  | { type: "text"; text: string; key: string }
  | { type: "gap"; gapNumber: number; key: string };

/**
 * Splits a Reading 1B shared passage on its `{{blank:N}}` gap markers so
 * callers can render the surrounding text and each numbered gap separately.
 */
export function parseClozeMarkers(passage: string): ClozeToken[] {
  const tokens: ClozeToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  BLANK_MARKER.lastIndex = 0;
  while ((match = BLANK_MARKER.exec(passage)) !== null) {
    if (match.index > lastIndex) tokens.push({ type: "text", text: passage.slice(lastIndex, match.index), key: `text-${lastIndex}` });
    tokens.push({ type: "gap", gapNumber: Number(match[1]), key: `gap-${match.index}` });
    lastIndex = BLANK_MARKER.lastIndex;
  }
  if (lastIndex < passage.length) tokens.push({ type: "text", text: passage.slice(lastIndex), key: `text-${lastIndex}` });
  return tokens;
}
