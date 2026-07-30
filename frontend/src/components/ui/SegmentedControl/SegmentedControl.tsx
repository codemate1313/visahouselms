import { type ReactNode, useEffect, useRef, useState, type CSSProperties } from "react";
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
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  value: T;
}

export function SegmentedControl<T extends string>({
  ariaLabel,
  className = "",
  fullWidth = false,
  iconOnly = false,
  onChange,
  options,
  size = "md",
  value,
}: SegmentedControlProps<T>) {
  const classes = [
    "ui-segmented-control",
    `ui-segmented-control--${size}`,
    fullWidth ? "ui-segmented-control--full" : "",
    iconOnly ? "ui-segmented-control--icon-only" : "",
    className,
  ].filter(Boolean).join(" ");

  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState<CSSProperties>({
    transform: "none",
    width: 0,
    height: 0,
    top: 0,
    opacity: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSlider = () => {
      const activeEl = container.querySelector(".ui-segmented-option.is-active") as HTMLElement;
      if (!activeEl) return;

      setSliderStyle({
        transform: `translateX(${activeEl.offsetLeft}px)`,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        top: activeEl.offsetTop,
        opacity: 1,
      });
    };

    // Run measurement initially and on state modifications
    updateSlider();

    // Use ResizeObserver for responsive adjustment of the slider positioning
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateSlider);
      observer.observe(container);
      return () => observer.disconnect();
    } else {
      window.addEventListener("resize", updateSlider);
      return () => window.removeEventListener("resize", updateSlider);
    }
  }, [value, options]);

  return (
    <div ref={containerRef} className={classes} role="group" aria-label={ariaLabel}>
      <span className="ui-segmented-slider" style={sliderStyle} aria-hidden="true" />
      {options.map((option) => (
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
      ))}
    </div>
  );
}
