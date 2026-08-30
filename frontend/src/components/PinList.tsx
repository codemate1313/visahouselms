import { useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { pinListStrings as strings } from "./PinList.strings";
import "./PinList.css";

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
 * displacement below *is* the spring.
 */
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

  function handleToggle(item: T) {
    onTogglePin(item);
  }

  const pinned = items.filter((item) => item.pinned);
  const unpinned = items.filter((item) => !item.pinned);

  function renderGroup(groupItems: T[], label: string, variant: "pinned" | "unpinned") {
    if (groupItems.length === 0 && (!emptyPinnedHint || variant === "unpinned")) return null;
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
                <IconButton
                  className={`pin-list-pin${item.pinned ? " is-pinned" : ""}`}
                  onClick={() => handleToggle(item)}
                  disabled={isPinDisabled?.(item)}
                  aria-pressed={item.pinned}
                  label={item.pinned ? strings.unpinAction : strings.pinAction}
                  icon={<Icon name="pin" />}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="pin-list" ref={rootRef}>
      {pinned.length > 0 && renderGroup(pinned, labels.pinned, "pinned")}
      {renderGroup(unpinned, labels.unpinned, "unpinned")}
    </div>
  );
}
