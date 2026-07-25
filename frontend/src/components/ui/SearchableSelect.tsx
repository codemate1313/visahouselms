import { useEffect, useRef, useState } from "react";

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
  const [alignRight, setAlignRight] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const filteredOptions = options.filter(
    (opt) =>
      !searchable ||
      !search ||
      opt.label.toLowerCase().includes(search.toLowerCase()) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceOnRight = window.innerWidth - rect.right;
        setAlignRight(spaceOnRight < 220);
      }
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 40);
      }
    } else {
      setSearch("");
    }
  }, [isOpen, searchable]);

  function handleSelect(optValue: string | number) {
    onChange(optValue);
    setIsOpen(false);
    setSearch("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

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
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
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

      {isOpen && (
        <div className={`searchable-select-dropdown ${alignRight ? "align-right" : ""}`} role="listbox">
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
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          )}

          <div className="select-options-list">
            {filteredOptions.length === 0 ? (
              <div className="select-empty-message">{emptyMessage}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <div
                    key={opt.value}
                    className={`select-option-item ${isSelected ? "is-selected" : ""} ${
                      opt.disabled ? "is-disabled" : ""
                    }`}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    role="option"
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
      )}
    </div>
  );
}
