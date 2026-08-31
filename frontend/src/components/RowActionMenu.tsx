import {
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { placeAnchoredMenu, placeTooltip, type AnchoredMenuPlacement, type TooltipPlacement } from "@/utils/anchoredMenu";

interface RowActionMenuProps {
  items: ReactElement[];
  label?: string;
}

export function RowActionMenu({ items, label = "More actions" }: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<AnchoredMenuPlacement | null>(null);
  const [tooltipHovered, setTooltipHovered] = useState(false);
  const [tooltipPlacement, setTooltipPlacement] = useState<TooltipPlacement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  /* The panel is `width: max-content`, so it has to exist before it can be
     measured. This runs before paint, so the un-placed first render is never
     visible — see the hidden-until-placed style below. */
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    // Measured while still unplaced, so this is the menu's natural size.
    const natural = panel.getBoundingClientRect();
    setPlacement(
      placeAnchoredMenu(trigger, {
        align: "end",
        gap: 8,
        width: natural.width,
        desiredHeight: natural.height,
        minHeight: 140,
      }),
    );
  }, [open, items.length]);

  /* Same measure-then-place two-step as the panel above: render hidden to
     get the tooltip's natural size, then place it against the trigger. */
  useLayoutEffect(() => {
    if (!tooltipHovered || open) {
      setTooltipPlacement(null);
      return;
    }
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const natural = tooltip.getBoundingClientRect();
    setTooltipPlacement(placeTooltip(trigger, { width: natural.width, height: natural.height }));
  }, [tooltipHovered, open]);

  useEffect(() => {
    if (!open) return;
    setTooltipHovered(false);

    function closeWhenOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function closeOnViewportChange() {
      setOpen(false);
    }

    document.addEventListener("pointerdown", closeWhenOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);
    return () => {
      document.removeEventListener("pointerdown", closeWhenOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="action-btn-icon action-menu-trigger"
        onBlur={() => setTooltipHovered(false)}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setTooltipHovered(true)}
        onMouseEnter={() => setTooltipHovered(true)}
        onMouseLeave={() => setTooltipHovered(false)}
        type="button"
      >
        <Icon name="moreVertical" />
      </button>
      {tooltipHovered && !open && createPortal(
        <div
          ref={tooltipRef}
          className={`row-action-tooltip${tooltipPlacement?.openBelow ? " row-action-tooltip-below" : ""}`}
          role="tooltip"
          style={
            tooltipPlacement
              ? { top: tooltipPlacement.top, left: tooltipPlacement.left }
              : { visibility: "hidden", top: 0, left: 0 }
          }
        >
          {label}
        </div>,
        document.body,
      )}
      {open && createPortal(
        <div
          ref={panelRef}
          className="row-action-menu-panel users-row-action-menu-panel"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button, a")) setOpen(false);
          }}
          role="menu"
          style={
            placement
              ? { top: placement.top, left: placement.left, maxHeight: placement.maxHeight }
              : { visibility: "hidden" }
          }
        >
          {items}
        </div>,
        document.body,
      )}
    </>
  );
}
