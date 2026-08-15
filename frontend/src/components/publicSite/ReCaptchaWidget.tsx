import { useState, useId } from "react";
import "@/styles/public/recaptcha.css";

interface ReCaptchaWidgetProps {
  verified: boolean;
  onVerify: (isVerified: boolean) => void;
  hasError?: boolean;
}

export function ReCaptchaWidget({ verified, onVerify, hasError }: ReCaptchaWidgetProps) {
  const [loading, setLoading] = useState(false);
  const checkboxId = useId();

  const handleToggle = () => {
    if (verified || loading) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onVerify(true);
    }, 600);
  };

  return (
    <div
      className={`vh-recaptcha-card ${verified ? "is-verified" : ""} ${hasError && !verified ? "has-error" : ""}`}
      role="region"
      aria-label="reCAPTCHA verification"
    >
      <div className="vh-recaptcha-left">
        <button
          type="button"
          id={checkboxId}
          className="vh-recaptcha-checkbox"
          onClick={handleToggle}
          disabled={verified || loading}
          aria-checked={verified}
          role="checkbox"
          aria-label="I'm not a robot checkbox"
        >
          {loading ? (
            <span className="vh-recaptcha-spinner" />
          ) : verified ? (
            <svg className="vh-recaptcha-checkmark" viewBox="0 0 24 24" fill="none" stroke="#00a651" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : null}
        </button>
        <label htmlFor={checkboxId} className="vh-recaptcha-label" onClick={handleToggle}>
          I'm not a robot
        </label>
      </div>

      <div className="vh-recaptcha-right">
        <div className="vh-recaptcha-logo-icon">
          <svg width="26" height="26" viewBox="0 0 48 48" fill="none" aria-hidden="true">
            <path
              d="M24 4C12.95 4 4 12.95 4 24c0 4.1 1.25 7.9 3.4 11.05L12 30.4C10.75 28.5 10 26.35 10 24c0-7.73 6.27-14 14-14 3.4 0 6.5 1.22 8.9 3.25l4.35-4.35C33.45 5.8 28.95 4 24 4z"
              fill="#4285F4"
            />
            <path
              d="M44 24c0-4.1-1.25-7.9-3.4-11.05L36 17.6c1.25 1.9 2 4.05 2 6.4 0 7.73-6.27 14-14 14-3.4 0-6.5-1.22-8.9-3.25l-4.35 4.35C14.55 42.2 19.05 44 24 44c11.05 0 20-8.95 20-20z"
              fill="#4285F4"
            />
            <path
              d="M24 16c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"
              fill="#A1A8B3"
            />
          </svg>
        </div>
        <span className="vh-recaptcha-brand">reCAPTCHA</span>
        <div className="vh-recaptcha-links">
          <a href="https://www.google.com/intl/en/policies/privacy/" target="_blank" rel="noopener noreferrer">
            Privacy
          </a>
          <span className="vh-recaptcha-sep">-</span>
          <a href="https://www.google.com/intl/en/policies/terms/" target="_blank" rel="noopener noreferrer">
            Terms
          </a>
        </div>
      </div>
    </div>
  );
}
