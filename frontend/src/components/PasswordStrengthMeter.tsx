import { evaluatePassword } from "../utils/passwordStrength";

const SCORE_CLASSES = ["", "score-1", "score-2", "score-3", "score-4"];

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = evaluatePassword(password);

  if (password.length === 0) {
    return (
      <div className="strength-meter">
        <p className="hint">
          Use at least 8 characters, with uppercase, lowercase, a digit, and a special character.
        </p>
      </div>
    );
  }

  return (
    <div className="strength-meter">
      <div className={`strength-bars ${SCORE_CLASSES[strength.score]}`}>
        {[1, 2, 3, 4].map((bar) => (
          <span key={bar} className={`strength-bar ${bar <= strength.score ? "filled" : ""}`} />
        ))}
      </div>
      <p className={`strength-label ${SCORE_CLASSES[strength.score]}`}>{strength.label}</p>
      {!strength.allMet && (
        <ul className="strength-rules">
          {strength.rules.map((rule) => (
            <li key={rule.label} className={rule.met ? "met" : "unmet"}>
              {rule.met ? "✓" : "✗"} {rule.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
