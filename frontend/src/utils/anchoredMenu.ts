/**
 * Placement math shared by every anchored popup in the app — select dropdowns,
 * row action menus and collapsed segmented controls.
 *
 * All of them portal to <body> and position themselves `fixed`, which frees
 * them from ancestor overflow but hands them the viewport-edge problem: a
 * trigger low on the page opened a panel that ran past the bottom of the
 * window, so its last options were unreachable and the panel read as if it had
 * failed to open at all.
 *
 * Three rules, applied in order:
 *   1. flip above the trigger when below cannot hold the panel and above is
 *      roomier;
 *   2. clamp the panel to the space that side actually offers, so it scrolls
 *      instead of bleeding off screen;
 *   3. on a viewport too short for either side, slide the panel back inside the
 *      margin even if that means overlapping its own trigger.
 *
 * The result is always fully on screen and always scrollable to its last item.
 */

export interface AnchoredMenuOptions {
  /** Desired panel width in px; clamped to the viewport. */
  width: number;
  /** Which trigger edge the panel lines up with. Defaults to "start" (left). */
  align?: "start" | "end";
  /** Space between trigger and panel. */
  gap?: number;
  /** Minimum breathing room between panel and viewport edge. */
  margin?: number;
  /** Natural (unclamped) panel height — drives the flip decision. */
  desiredHeight?: number;
  /** Height the panel is still usable at, below which flipping is pointless. */
  minHeight?: number;
}

export interface AnchoredMenuPlacement {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUpward: boolean;
}

const DEFAULT_GAP = 6;
const DEFAULT_MARGIN = 12;
const DEFAULT_MIN_HEIGHT = 180;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function placeAnchoredMenu(
  anchor: HTMLElement | DOMRect,
  options: AnchoredMenuOptions,
): AnchoredMenuPlacement {
  const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
  const gap = options.gap ?? DEFAULT_GAP;
  const margin = options.margin ?? DEFAULT_MARGIN;
  const minHeight = options.minHeight ?? DEFAULT_MIN_HEIGHT;

  // clientWidth/Height exclude the classic scrollbar gutter, so a panel pinned
  // to the right edge never hides under it.
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const viewportHeight = document.documentElement.clientHeight || window.innerHeight;

  const width = Math.min(options.width, Math.max(viewportWidth - margin * 2, 0));
  const left = clamp(
    options.align === "end" ? rect.right - width : rect.left,
    margin,
    Math.max(margin, viewportWidth - margin - width),
  );

  const spaceBelow = viewportHeight - rect.bottom - gap - margin;
  const spaceAbove = rect.top - gap - margin;
  const desiredHeight = options.desiredHeight ?? minHeight;
  const openUpward = spaceBelow < desiredHeight && spaceAbove > spaceBelow;

  const room = Math.max(openUpward ? spaceAbove : spaceBelow, 0);
  // Never shrink below `minHeight` just because the chosen side is cramped —
  // a 40px sliver of list is worse than a panel that overlaps its trigger. The
  // viewport itself is the only hard ceiling.
  const usable = Math.max(room, Math.min(minHeight, Math.max(viewportHeight - margin * 2, 0)));
  const maxHeight = Math.min(desiredHeight, usable);

  const top = clamp(
    openUpward ? rect.top - gap - maxHeight : rect.bottom + gap,
    margin,
    Math.max(margin, viewportHeight - margin - maxHeight),
  );

  return { top, left, width, maxHeight, openUpward };
}
