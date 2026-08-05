import type { PointerEvent } from "react";

/**
 * Makes a chart's hover readout reachable without a mouse.
 *
 * These charts were wired to `onMouseEnter`/`onMouseLeave`, which a touch
 * device never fires - so on a phone every value in every chart was simply
 * unreadable. Pointer events cover mouse, pen and touch from one handler.
 *
 * The asymmetry is deliberate. A touch pointer stops existing the instant the
 * finger lifts, so honouring `pointerleave` for touch would blank the tooltip
 * before it could be read; for touch the readout stays until another segment is
 * tapped. A mouse still clears on leave, as it should.
 */
export function chartHoverProps(onEnter: () => void, onLeave: () => void) {
  return {
    onPointerEnter: onEnter,
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === "mouse") onLeave();
    },
    // Keyboard users get the same readout as everyone else.
    onFocus: onEnter,
    onBlur: onLeave,
  };
}
