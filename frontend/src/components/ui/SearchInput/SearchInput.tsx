import type { InputHTMLAttributes } from "react";
import "./SearchInput.css";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { commonActions } from "@/content/common.strings";

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
  fullWidth?: boolean;
}

/**
 * Shared search box: icon, controlled value, and a clear button that only
 * appears once there's something to clear. Replaces the many hand-rolled
 * `placeholder="Search..."` inputs duplicated across pages.
 */
export function SearchInput({
  value,
  onChange,
  fullWidth,
  width,
  placeholder = "Search...",
  className = "",
  ...rest
}: SearchInputProps) {
  const effectiveWidth = fullWidth ? "100%" : width;
  return (
    <div className={`ui-search-input ${className}`} style={effectiveWidth !== undefined ? { width: effectiveWidth } : undefined}>
      <svg
        className="ui-search-input-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7.5" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        {...rest}
      />
      {value && (
        <IconButton
          className="ui-search-input-clear"
          onClick={() => onChange("")}
          label={commonActions.clearSearch}
          icon={<Icon name="cross" />}
        />
      )}
    </div>
  );
}
