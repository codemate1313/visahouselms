import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { Icon } from "@/components/icons";
import { pinListStrings as strings } from "./PinList.strings";
import "./PinList.css";

gsap.registerPlugin(Flip);

/**
 * Grouped pin list, ported from animate-ui's community `pin-list`.
 *
 * Items split into a "Pinned" group and an "All" group; toggling an item's
 * pinned state animates it between the two groups while every other row
 * springs into its new position. animate-ui drives this with framer-motion's
 * `layout` prop — this project already ships GSAP, so the same FLIP technique
 * runs through GSAP's Flip plugin instead of pulling in a second animation
 * library.
 *
 * Motion matches the documented animate-ui default exactly rather than
 * approximating it with a named ease: solving
 *   { type: "spring", stiffness: 320, damping: 20, mass: 0.8 }
 * gives omega0 = 20 rad/s, zeta = 0.625 (underdamped, ~8% overshoot),
 * settling in 345ms. GSAP takes a raw ease function, so the closed-form
 * displacement below *is* the spring.
 */
const SPRING_ZETA_OMEGA = 12.5; // zeta * omega0
const SPRING_OMEGA_D = 15.6125; // damped angular frequency
const FLIP_DURATION = 0.345;
const FLIP_EASE = (t: number) => {
  const tau = t * FLIP_DURATION;
  return (
    1 -
    Math.exp(-SPRING_ZETA_OMEGA * tau) *
      (Math.cos(SPRING_OMEGA_D * tau) + (SPRING_ZETA_OMEGA / SPRING_OMEGA_D) * Math.sin(SPRING_OMEGA_D * tau))
  );
};
const Z_INDEX_RESET_DELAY = 500;

export interface PinListItem {
  id: number | string;
  pinned: boolean;
}

interface PinListProps<T extends PinListItem> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  onTogglePin: (item: T) => void;
  labels?: { pinned: string; unpinned: string };
  isPinDisabled?: (item: T) => boolean;
  emptyPinnedHint?: string;
}

export function PinList<T extends PinListItem>({
  items,
  renderItem,
  onTogglePin,
  labels = { pinned: strings.pinnedLabel, unpinned: strings.unpinnedLabel },
  isPinDisabled,
  emptyPinnedHint = strings.emptyPinnedHint,
}: PinListProps<T>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<Flip.FlipState | null>(null);
  const signature = items.map((item) => `${item.id}:${item.pinned ? 1 : 0}`).join(",");

  // Capture positions before React commits the reordered DOM, then play the
  // rows from their old boxes to the new ones.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const previous = stateRef.current;
    stateRef.current = Flip.getState(root.querySelectorAll("[data-pin-row]"));
    if (!previous) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    Flip.from(previous, {
      targets: root.querySelectorAll("[data-pin-row]"),
      duration: FLIP_DURATION,
      ease: FLIP_EASE,
      absolute: true,
      nested: true,
      onEnter: (elements) => gsap.fromTo(elements, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.3 }),
      onLeave: (elements) => gsap.to(elements, { opacity: 0, scale: 0.96, duration: 0.2 }),
    });
  }, [signature]);

  // animate-ui lifts the moving row above its neighbours during the transition
  // and resets the stacking context afterwards (zIndexResetDelay, default 500ms).
  function handleToggle(item: T) {
    const row = rootRef.current?.querySelector<HTMLElement>(`[data-pin-row="${item.id}"]`);
    if (row) {
      row.style.zIndex = "2";
      window.setTimeout(() => {
        row.style.zIndex = "";
      }, Z_INDEX_RESET_DELAY);
    }
    onTogglePin(item);
  }

  const pinned = items.filter((item) => item.pinned);
  const unpinned = items.filter((item) => !item.pinned);

  function renderGroup(groupItems: T[], label: string, variant: "pinned" | "unpinned") {
    if (groupItems.length === 0) return null;
    return (
      <section className={`pin-list-group pin-list-group-${variant}`}>
        <h2 className="pin-list-label">
          {variant === "pinned" && <Icon name="pin" />}
          {label}
          <span className="pin-list-count">{groupItems.length}</span>
        </h2>
        {groupItems.length === 0 ? (
          <p className="pin-list-empty-hint">{emptyPinnedHint}</p>
        ) : (
          <ul className="pin-list-rows">
            {groupItems.map((item) => (
              <li key={item.id} data-pin-row={item.id} className="pin-list-row">
                {renderItem(item)}
                <button
                  type="button"
                  className={`pin-list-pin${item.pinned ? " is-pinned" : ""}`}
                  onClick={() => handleToggle(item)}
                  disabled={isPinDisabled?.(item)}
                  aria-pressed={item.pinned}
                  title={item.pinned ? strings.unpinAction : strings.pinAction}
                >
                  <Icon name="pin" />
                  <span className="visually-hidden">{item.pinned ? strings.unpinAction : strings.pinAction}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="pin-list" ref={rootRef}>
      {(pinned.length > 0 || items.length > 0) && renderGroup(pinned, labels.pinned, "pinned")}
      {renderGroup(unpinned, labels.unpinned, "unpinned")}
    </div>
  );
}
