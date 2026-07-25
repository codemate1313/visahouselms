import type { InputHTMLAttributes } from "react";
import "./SearchInput.css";

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange" | "width"> {
  value: string;
  onChange: (value: string) => void;
  /**
   * Sets the rendered width for this instance. Omit to let it fill its
   * flex/grid container — the component itself has no fixed width, so the
   * same SearchInput can be a compact toolbar filter in one screen and a
   * full-width search bar in another just by passing this prop.
   */
  width?: number | string;
}

/**
 * Shared search box: icon, controlled value, and a clear button that only
 * appears once there's something to clear. Replaces the many hand-rolled
 * `placeholder="Search..."` inputs duplicated across pages.
 */
export function SearchInput({
  value,
  onChange,
  width,
  placeholder = "Search...",
  className = "",
  ...rest
}: SearchInputProps) {
  return (
    <div className={`ui-search-input ${className}`} style={width !== undefined ? { width } : undefined}>
      <svg
        className="ui-search-input-icon"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        {...rest}
      />
      {value && (
        <button
          type="button"
          className="ui-search-input-clear"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
