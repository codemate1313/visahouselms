import { instituteFormStrings as strings } from "../InstituteForm.strings";

interface SessionPolicyFieldsetProps {
  sessionDurationHours: number;
  onSessionDurationHoursChange: (value: number) => void;
}

export function SessionPolicyFieldset({ sessionDurationHours, onSessionDurationHoursChange }: SessionPolicyFieldsetProps) {
  const t = strings.sessionPolicy;
  return (
    <fieldset className="permission-fieldset">
      <legend>{t.legend}</legend>
      <p className="hint">{t.description}</p>
      <label htmlFor="session-duration-hours">{t.lifetimeLabel}</label>
      <input
        id="session-duration-hours"
        type="number"
        min="1"
        max="720"
        value={sessionDurationHours}
        onChange={(event) => onSessionDurationHoursChange(Number(event.target.value))}
        required
      />
    </fieldset>
  );
}
