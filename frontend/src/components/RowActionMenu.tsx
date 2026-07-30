import {
  type ReactElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";

interface RowActionMenuProps {
  items: ReactElement[];
  label?: string;
}

interface MenuPosition {
  bottom?: number;
  right: number;
  top?: number;
}

export function RowActionMenu({ items, label = "More actions" }: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ right: 12, top: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const right = Math.max(12, window.innerWidth - rect.right);
    const roomBelow = window.innerHeight - rect.bottom;

    setPosition(
      roomBelow >= 230
        ? { right, top: rect.bottom + 8 }
        : { bottom: window.innerHeight - rect.top + 8, right },
    );
  }, [open]);

  useEffect(() => {
    if (!open) return;

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
        data-tooltip={label}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Icon name="moreVertical" />
      </button>
      {open && createPortal(
        <div
          ref={panelRef}
          className="row-action-menu-panel users-row-action-menu-panel"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button, a")) setOpen(false);
          }}
          role="menu"
          style={position}
        >
          {items}
        </div>,
        document.body,
      )}
    </>
  );
}
