import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./SearchableSelect.css";
import { Icon } from "@/components/icons";
import { commonActions } from "@/content/common.strings";
import { placeAnchoredMenu, type AnchoredMenuPlacement } from "@/utils/anchoredMenu";

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id?: string;
  options: SelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
  ariaLabel?: string;
}

/* Row/chrome heights used to estimate the panel's natural height. They only
   need to be close: the estimate picks the flip side and the max-height, and
   anything taller than the estimate simply scrolls. */
const OPTION_ROW_HEIGHT = 38;
const SEARCH_HEADER_HEIGHT = 51;
const PANEL_CHROME_HEIGHT = 20;
const MAX_PANEL_HEIGHT = 320;
const MIN_PANEL_WIDTH = 200;

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  searchable = true,
  disabled = false,
  className = "",
  emptyMessage = "No matching options found.",
  ariaLabel,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [placement, setPlacement] = useState<AnchoredMenuPlacement | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = useMemo(
    () =>
      options.filter(
        (opt) =>
          !searchable ||
          !search ||
          opt.label.toLowerCase().includes(search.toLowerCase()) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
      ),
    [options, search, searchable],
  );

  /**
   * Compute fixed-position coordinates for the portal dropdown. The shared
   * helper does the flipping and viewport clamping, so a select at the very
   * bottom of a long form opens a shorter, scrollable panel instead of one that
   * runs off screen.
   */
  const computePlacement = useCallback((): AnchoredMenuPlacement | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const rows = Math.max(filteredOptions.length, 1);
    return placeAnchoredMenu(trigger, {
      width: Math.max(trigger.offsetWidth, MIN_PANEL_WIDTH),
      desiredHeight: Math.min(
        PANEL_CHROME_HEIGHT + (searchable ? SEARCH_HEADER_HEIGHT : 0) + rows * OPTION_ROW_HEIGHT,
        MAX_PANEL_HEIGHT,
      ),
    });
  }, [filteredOptions.length, searchable]);

  /** Recompute on scroll / resize so the portal stays anchored. */
  useEffect(() => {
    if (!isOpen) return;
    function update() {
      setPlacement(computePlacement());
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, computePlacement]);

  /** Close on outside click — check both the container and the portal dropdown. */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const inContainer = containerRef.current?.contains(target) ?? false;
      const inDropdown = dropdownRef.current?.contains(target) ?? false;
      if (!inContainer && !inDropdown) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPlacement(computePlacement());
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 40);
      }
      const selectedIndex = filteredOptions.findIndex(
        (option) => !option.disabled && String(option.value) === String(value),
      );
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : filteredOptions.findIndex((option) => !option.disabled));
    } else {
      setSearch("");
      setHighlightedIndex(-1);
      setPlacement(null);
    }
  }, [filteredOptions, isOpen, searchable, value, computePlacement]);

  useEffect(() => {
    if (!isOpen) return;
    const firstEnabled = filteredOptions.findIndex((option) => !option.disabled);
    setHighlightedIndex((current) => {
      if (current >= 0 && current < filteredOptions.length && !filteredOptions[current]?.disabled) return current;
      return firstEnabled;
    });
  }, [filteredOptions, isOpen]);

  function handleSelect(optValue: string | number) {
    onChange(optValue);
    setIsOpen(false);
    setSearch("");
  }

  function moveHighlight(direction: 1 | -1) {
    if (filteredOptions.length === 0) return;
    setHighlightedIndex((current) => {
      let next = current;
      for (let count = 0; count < filteredOptions.length; count += 1) {
        next = (next + direction + filteredOptions.length) % filteredOptions.length;
        if (!filteredOptions[next]?.disabled) return next;
      }
      return current;
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        moveHighlight(e.key === "ArrowDown" ? 1 : -1);
      }
    } else if (e.key === "Enter" && isOpen && highlightedIndex >= 0) {
      e.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option && !option.disabled) handleSelect(option.value);
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  }

  const dropdownStyle: React.CSSProperties = placement
    ? {
        position: "fixed",
        top: placement.top,
        left: placement.left,
        width: placement.width,
        maxHeight: placement.maxHeight,
        zIndex: 99999,
      }
    : {};

  const dropdownNode = isOpen && placement ? (
    <div
      ref={dropdownRef}
      id={listboxId}
      className={`searchable-select-dropdown searchable-select-portal-dropdown${placement.openUpward ? " opens-upward" : ""}`}
      role="listbox"
      style={dropdownStyle}
      onKeyDown={handleKeyDown}
    >
      {searchable && (
        <div className="select-search-header">
          <svg
            className="select-search-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="select-search-input"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {search && (
            <button
              type="button"
              className="select-search-clear"
              onClick={() => setSearch("")}
              title={commonActions.clearSearch}
              aria-label={commonActions.clearSearch}
            >
              <Icon name="cross" />
            </button>
          )}
        </div>
      )}

      <div className="select-options-list">
        {filteredOptions.length === 0 ? (
          <div className="select-empty-message">{emptyMessage}</div>
        ) : (
          filteredOptions.map((opt, optionIndex) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <div
                key={opt.value}
                id={`${listboxId}-option-${optionIndex}`}
                className={`select-option-item ${isSelected ? "is-selected" : ""} ${
                  optionIndex === highlightedIndex ? "is-highlighted" : ""
                } ${opt.disabled ? "is-disabled" : ""}`}
                onClick={() => !opt.disabled && handleSelect(opt.value)}
                onMouseEnter={() => {
                  if (!opt.disabled) setHighlightedIndex(optionIndex);
                }}
                role="option"
                aria-disabled={opt.disabled || undefined}
                aria-selected={isSelected}
              >
                <div className="option-text-group">
                  <span className="option-main-label">{opt.label}</span>
                  {opt.sublabel && <span className="option-sub-label">{opt.sublabel}</span>}
                </div>
                {isSelected && (
                  <svg
                    className="option-check-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div
      className={`searchable-select-container ${isOpen ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="searchable-select-trigger"
        id={id}
        ref={triggerRef}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={isOpen && highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
        aria-label={ariaLabel ?? placeholder}
      >
        <span className={`selected-value-label ${!selectedOption ? "is-placeholder" : ""}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`select-chevron-icon ${isOpen ? "is-rotated" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Portal the dropdown to document.body so it escapes every overflow/
          stacking context — no matter how deep inside a scrollable panel it
          lives, the dropdown always floats above everything. */}
      {dropdownNode && createPortal(dropdownNode, document.body)}
    </div>
  );
}
