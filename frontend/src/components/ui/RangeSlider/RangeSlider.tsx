import { type CSSProperties, useId } from "react";
import "./RangeSlider.css";

export interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  /** Content of the floating balloon; defaults to the raw value. */
  formatBalloon?: (value: number) => string | number;
  /** Evenly spaced tick labels under the track. */
  scale?: number[];
  disabled?: boolean;
  className?: string;
}

/**
 * The project's range slider: a thin track, a large round handle, and a balloon
 * above the handle showing the current value as it moves.
 *
 * The balloon is a plain element positioned by percentage rather than anything
 * the native input can draw, which is the whole reason this is a component and
 * not just CSS. Its offset is nudged by half a thumb-width so it stays centred
 * on the handle at both ends instead of drifting past the track - the standard
 * correction for the gap between an input's value track and its thumb centre.
 *
 * Colour comes from `--primary`, so it themes with the rest of the app rather
 * than being pinned to one hue.
 */
const THUMB = 30; // must match the handle size in the stylesheet

export function RangeSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  ariaLabel,
  formatBalloon,
  scale,
  disabled = false,
  className = "",
}: RangeSliderProps) {
  const id = useId();
  const span = max - min || 1;
  const ratio = Math.min(1, Math.max(0, (value - min) / span));
  const percent = ratio * 100;
  // Centre the balloon (and the fill) on the thumb, correcting for the thumb's
  // own width at the extremes.
  const balloonOffset = `calc(${percent}% + ${(0.5 - ratio) * THUMB}px)`;

  return (
    <div className={`vh-range ${className}`.trim()}>
      <div
        className="vh-range-balloon"
        style={{ left: balloonOffset } as CSSProperties}
        aria-hidden="true"
      >
        <span className="vh-range-balloon-value">
          {formatBalloon ? formatBalloon(value) : value}
        </span>
      </div>

      <input
        id={id}
        className="vh-range-input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuetext={String(formatBalloon ? formatBalloon(value) : value)}
        style={{ "--vh-range-fill": `${percent}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />

      {scale && scale.length > 0 && (
        <div className="vh-range-scale" aria-hidden="true">
          {scale.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      )}
    </div>
  );
}
