import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./SegmentedControl.css";

export interface SegmentedOption<T extends string> {
  ariaLabel?: string;
  disabled?: boolean;
  icon?: ReactNode;
  label: ReactNode;
  title?: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  ariaLabel?: string;
  className?: string;
  fullWidth?: boolean;
  iconOnly?: boolean;
  /** Opt out of the small-screen dropdown for a control that must stay a row. */
  neverCollapse?: boolean;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  value: T;
}

/** Matches the project-wide mobile cutover used across the stylesheets. */
const MOBILE_QUERY = "(max-width: 768px)";

/** Keeps a narrow menu usable when the trigger itself is tiny. */
const MIN_MENU_WIDTH = 168;
const VIEWPORT_MARGIN = 8;

/**
 * Tracks whether the viewport is in the mobile range.
 *
 * Read synchronously on the first render so a phone never paints the row
 * layout for a frame before swapping to the dropdown.
 */
/**
 * How much horizontal room the control actually has.
 *
 * Not simply `parentElement.clientWidth`: a shrink-to-fit parent - and these
 * controls are routinely wrapped in an `inline-flex` div - is sized *by* the
 * control, so asking it how much room there is just echoes back the control's
 * own width and nothing ever looks cramped. So we climb past every shrink-to-fit
 * ancestor to the first one with a width of its own, then subtract whatever
 * siblings are sharing that row.
 *
 * Returns null when nothing can be measured yet (a panel mid-animation), which
 * the caller treats as "don't decide", distinct from a genuine zero.
 */
function measureAvailableWidth(wrap: HTMLElement): number | null {
  let child: HTMLElement = wrap;
  let parent = wrap.parentElement;

  while (parent) {
    const style = getComputedStyle(parent);
    const shrinksToFit =
      style.display.startsWith("inline") ||
      style.float !== "none" ||
      style.position === "absolute" ||
      style.position === "fixed";

    if (!shrinksToFit) {
      if (!parent.clientWidth) return null;
      let room =
        parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);

      // In a row, the siblings are the competition - the topbar's bell, theme
      // toggle and profile chip are why the range switch has to give way.
      if (style.display.includes("flex") && !style.flexDirection.startsWith("column")) {
        const gap = parseFloat(style.columnGap) || 0;
        for (const sibling of Array.from(parent.children)) {
          if (sibling === child) continue;
          room -= sibling.getBoundingClientRect().width + gap;
        }
      }
      return Math.max(0, room);
    }

    child = parent;
    parent = parent.parentElement;
  }

  return document.documentElement.clientWidth;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setIsMobile(query.matches);
    query.addEventListener("change", onChange);
    onChange();
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  className = "",
  fullWidth = false,
  iconOnly = false,
  neverCollapse = false,
  onChange,
  options,
  size = "md",
  value,
}: SegmentedControlProps<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const collapsed = isMobile && !neverCollapse && overflows;
  const active = options.find((option) => option.value === value) ?? options[0];

  /**
   * Overflow is measured against a hidden copy of the full option row rather
   * than the visible one, because the visible one stops existing the moment we
   * collapse - measuring it would make the answer depend on the answer. The
   * hidden copy is absolutely positioned, so it never affects layout and its
   * width stays the control's natural width in every state.
   */
  useLayoutEffect(() => {
    if (neverCollapse) return;
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    const parent = wrap?.parentElement;
    if (!wrap || !measure || !parent) return;

    const check = () => {
      const natural = measure.scrollWidth;
      const available = measureAvailableWidth(wrap);
      // Nothing measurable yet - a panel animating open reports zero, and
      // treating that as an overflow would collapse every control on the page.
      if (!natural || available === null) return;
      setOverflows(natural > available);
    };

    check();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }
    const observer = new ResizeObserver(check);
    observer.observe(parent);
    observer.observe(measure);
    // The constraining ancestor is often further up than the direct parent, and
    // it is the one that actually changes size on rotation or a sidebar toggle.
    if (document.body) observer.observe(document.body);
    return () => observer.disconnect();
  }, [neverCollapse, options, size, iconOnly]);

  // The sliding pill only exists in the expanded row.
  const [sliderStyle, setSliderStyle] = useState<CSSProperties>({
    transform: "none",
    width: 0,
    height: 0,
    top: 0,
    opacity: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container || collapsed) return;

    const updateSlider = () => {
      const activeEl = container.querySelector(".ui-segmented-option.is-active") as HTMLElement | null;
      if (!activeEl) return;
      setSliderStyle({
        transform: `translateX(${activeEl.offsetLeft}px)`,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        top: activeEl.offsetTop,
        opacity: 1,
      });
    };

    updateSlider();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSlider);
      return () => window.removeEventListener("resize", updateSlider);
    }
    const observer = new ResizeObserver(updateSlider);
    observer.observe(container);
    return () => observer.disconnect();
  }, [value, options, collapsed]);

  /**
   * The menu is fixed-positioned and portalled to the body.
   *
   * Several of these controls live inside drawers, modals and cards that clip
   * their overflow; a menu positioned inside the flow would be cut off or
   * trapped beneath a sibling's stacking context.
   */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, MIN_MENU_WIDTH);

    let left = rect.left;
    if (left + width > window.innerWidth - VIEWPORT_MARGIN) {
      left = window.innerWidth - VIEWPORT_MARGIN - width;
    }
    left = Math.max(VIEWPORT_MARGIN, left);

    // Drop upward when the space below cannot hold the list.
    const estimated = Math.min(options.length, 6) * 42 + 12;
    const below = window.innerHeight - rect.bottom;
    const dropUp = below < estimated && rect.top > below;

    setMenuStyle({
      left,
      width,
      maxHeight: Math.max(120, (dropUp ? rect.top : below) - VIEWPORT_MARGIN - 6),
      ...(dropUp ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    // Reposition rather than close, so a menu opened inside a scrollable panel
    // stays attached to its trigger instead of vanishing under the thumb.
    const onReflow = () => place();

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, close, place]);

  // Anything open must close if the control stops being a dropdown mid-gesture,
  // e.g. an orientation change that suddenly gives the row enough room.
  useEffect(() => {
    if (!collapsed && open) setOpen(false);
  }, [collapsed, open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(".ui-segmented-menu-option:not(:disabled)") ?? [],
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = event.key === "ArrowDown" ? index + 1 : index - 1;
      items[(next + items.length) % items.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
    } else if (event.key === "Tab") {
      close(false);
    }
  }

  function openMenu() {
    setOpen(true);
    // Focus the current choice so a keyboard user starts where they left off.
    window.requestAnimationFrame(() => {
      const current = menuRef.current?.querySelector<HTMLButtonElement>(
        ".ui-segmented-menu-option.is-active",
      );
      (current ?? menuRef.current?.querySelector<HTMLButtonElement>(".ui-segmented-menu-option"))?.focus();
    });
  }

  const classes = [
    "ui-segmented-control",
    `ui-segmented-control--${size}`,
    fullWidth ? "ui-segmented-control--full" : "",
    iconOnly ? "ui-segmented-control--icon-only" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  function renderOption(option: SegmentedOption<T>) {
    return (
      <button
        type="button"
        className={`ui-segmented-option${option.value === value ? " is-active" : ""}`}
        aria-label={option.ariaLabel}
        aria-pressed={option.value === value}
        disabled={option.disabled}
        key={option.value}
        onClick={() => onChange(option.value)}
        title={option.title}
      >
        {option.icon && <span className="ui-segmented-icon">{option.icon}</span>}
        <span className="ui-segmented-label">{option.label}</span>
      </button>
    );
  }

  return (
    <div
      ref={wrapRef}
      className={`ui-segmented-wrap${collapsed ? " is-collapsed" : ""}${fullWidth ? " is-full" : ""}`}
    >
      {collapsed ? (
        <button
          type="button"
          ref={triggerRef}
          className={`ui-segmented-trigger ui-segmented-trigger--${size}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          onClick={() => (open ? close(false) : openMenu())}
        >
          {active?.icon && <span className="ui-segmented-icon">{active.icon}</span>}
          <span className="ui-segmented-trigger-label">{active?.label}</span>
          <svg
            className="ui-segmented-trigger-caret"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      ) : (
        <div ref={containerRef} className={classes} role="group" aria-label={ariaLabel}>
          <span className="ui-segmented-slider" style={sliderStyle} aria-hidden="true" />
          {options.map(renderOption)}
        </div>
      )}

      {/* Never shown and never focusable - it exists only to hold the control's
          natural width so the overflow test has a stable thing to measure. */}
      {!neverCollapse && (
        <div ref={measureRef} className={`${classes} ui-segmented-measure`} aria-hidden="true">
          {options.map((option) => (
            <span className="ui-segmented-option" key={option.value}>
              {option.icon && <span className="ui-segmented-icon">{option.icon}</span>}
              <span className="ui-segmented-label">{option.label}</span>
            </span>
          ))}
        </div>
      )}

      {collapsed &&
        open &&
        createPortal(
          <div
            ref={menuRef}
            className="ui-segmented-menu"
            style={menuStyle}
            role="listbox"
            aria-label={ariaLabel}
            onKeyDown={onMenuKeyDown}
          >
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                className={`ui-segmented-menu-option${option.value === value ? " is-active" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  close(true);
                }}
              >
                {option.icon && <span className="ui-segmented-icon">{option.icon}</span>}
                <span className="ui-segmented-menu-label">{option.label}</span>
                {option.value === value && (
                  <svg
                    className="ui-segmented-menu-check"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
