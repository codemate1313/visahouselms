import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { placeTooltip, type TooltipPlacement } from "@/utils/anchoredMenu";

/**
 * One tooltip layer for every `data-tooltip` element in the app.
 *
 * These used to be a `::before` pseudo-element on the trigger itself, which
 * meant any ancestor that clipped its overflow clipped the tooltip with it -
 * a modal's rounded card cut the close button's tooltip in half, and table
 * wrappers did the same to row actions. Clipping is not a stacking problem, so
 * the `z-index: 9999999` piled onto those rules could never have fixed it.
 *
 * Rendering here instead - portaled to <body>, positioned `fixed` from the
 * trigger's own rect - escapes every ancestor, and lets the tooltip flip below
 * the trigger when there is no room above it. Triggers keep their existing
 * `data-tooltip` attribute, so nothing at the call sites changes.
 */

/** Snackbars carry their own close affordance and suppress tooltips. */
const SUPPRESSED_WITHIN = ".snackbar-item";

interface ActiveTooltip {
  text: string;
  trigger: HTMLElement;
}

export function GlobalTooltip() {
  const [active, setActive] = useState<ActiveTooltip | null>(null);
  const [placement, setPlacement] = useState<TooltipPlacement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const hide = useCallback(() => {
    setActive(null);
    setPlacement(null);
  }, []);

  const show = useCallback((trigger: HTMLElement) => {
    const text = trigger.getAttribute("data-tooltip")?.trim();
    if (!text || trigger.closest(SUPPRESSED_WITHIN)) return;
    // `aria-label` (or the trigger's own text) already announces this to a
    // screen reader, so the tooltip is decoration for pointer users and stays
    // out of the accessibility tree.
    setActive((current) => {
      // Moving across a trigger's own children re-fires pointerover; replacing
      // the state each time would restart the fade and re-measure for nothing.
      if (current && current.trigger === trigger && current.text === text) return current;
      return { text, trigger };
    });
  }, []);

  useEffect(() => {
    function onPointerOver(event: PointerEvent) {
      // A touch tap fires pointerover then click; a tooltip that appears under
      // the finger and lingers is noise, so touch is left alone.
      if (event.pointerType === "touch") return;
      const trigger = (event.target as Element | null)?.closest?.("[data-tooltip]");
      if (trigger instanceof HTMLElement) show(trigger);
    }

    function onPointerOut(event: PointerEvent) {
      const trigger = (event.target as Element | null)?.closest?.("[data-tooltip]");
      if (!(trigger instanceof HTMLElement)) return;
      // Moving between a trigger's own children is not leaving the trigger.
      const next = event.relatedTarget;
      if (next instanceof Node && trigger.contains(next)) return;
      hide();
    }

    function onFocusIn(event: FocusEvent) {
      const trigger = event.target;
      if (!(trigger instanceof HTMLElement)) return;
      // Keyboard focus earns a tooltip; a click that moves focus does not, or
      // every button press would leave one hanging behind the pointer.
      if (!trigger.matches("[data-tooltip]:focus-visible")) return;
      show(trigger);
    }

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", hide, true);
    // Anything that moves the trigger out from under the tooltip dismisses it:
    // the position was measured once and does not follow.
    document.addEventListener("pointerdown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", hide, true);
      document.removeEventListener("pointerdown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [hide, show]);

  useEffect(() => {
    if (!active) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide();
    }
    window.addEventListener("keydown", onKeyDown);

    /* A trigger can vanish under the pointer without ever firing pointerout -
       a row that re-renders, a modal that closes on the very button being
       hovered - and the tooltip would hang there over the page with nothing
       to dismiss it. Checking that it is still mounted and still hovered
       costs nothing and only runs while one is on screen. */
    const liveness = window.setInterval(() => {
      const { trigger } = active;
      if (!trigger.isConnected || !trigger.matches(":hover, :focus-visible")) hide();
    }, 400);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearInterval(liveness);
    };
  }, [active, hide]);

  /* Measured after the tooltip exists but before paint, so the unplaced first
     render is never visible - see the hidden-until-placed style below. */
  useLayoutEffect(() => {
    if (!active) return;
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    // A trigger can be unmounted between hover and paint (a row that
    // re-renders, a menu that closes) - there is nothing left to point at.
    if (!active.trigger.isConnected) {
      hide();
      return;
    }
    const box = tooltip.getBoundingClientRect();
    setPlacement(placeTooltip(active.trigger, { width: box.width, height: box.height }));
  }, [active, hide]);

  if (!active) return null;

  return createPortal(
    <div
      ref={tooltipRef}
      className={`ui-tooltip${placement?.openBelow ? " ui-tooltip-below" : ""}`}
      role="presentation"
      aria-hidden="true"
      style={
        placement
          ? { top: placement.top, left: placement.left }
          : { visibility: "hidden", top: 0, left: 0 }
      }
    >
      {active.text}
    </div>,
    document.body,
  );
}
