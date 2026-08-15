import { RequiredMark } from "@/components/ui";

interface MinuteSecondInputProps {
  id: string;
  label: string;
  value: number;
  minSeconds: number;
  maxSeconds: number;
  onChange: (totalSeconds: number) => void;
  readOnly?: boolean;
  required?: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function MinuteSecondInput({
  id,
  label,
  value,
  minSeconds,
  maxSeconds,
  onChange,
  readOnly = false,
  required = false,
}: MinuteSecondInputProps) {
  const totalSeconds = clamp(Math.round(Number(value) || 0), minSeconds, maxSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const maxMinutes = Math.floor(maxSeconds / 60);

  const updateMinutes = (nextMinutes: number) => {
    onChange(clamp(nextMinutes * 60 + seconds, minSeconds, maxSeconds));
  };

  const updateSeconds = (nextSeconds: number) => {
    onChange(clamp(minutes * 60 + clamp(nextSeconds, 0, 59), minSeconds, maxSeconds));
  };

  return (
    <fieldset className="vh-minute-second-field">
      <legend>{label}{required ? <RequiredMark /> : null}</legend>
      <div className="vh-minute-second-inputs" role="group" aria-label={label}>
        <label htmlFor={`${id}-minutes`}>
          <span>Minutes</span>
          <input
            id={`${id}-minutes`}
            type="number"
            min={0}
            max={maxMinutes}
            value={minutes}
            onChange={(event) => updateMinutes(Number(event.target.value))}
            readOnly={readOnly}
            required={required}
            inputMode="numeric"
          />
        </label>
        <span className="vh-duration-separator" aria-hidden="true">:</span>
        <label htmlFor={`${id}-seconds`}>
          <span>Seconds</span>
          <input
            id={`${id}-seconds`}
            type="number"
            min={0}
            max={59}
            value={seconds}
            onChange={(event) => updateSeconds(Number(event.target.value))}
            readOnly={readOnly}
            required={required}
            inputMode="numeric"
          />
        </label>
      </div>
    </fieldset>
  );
}
