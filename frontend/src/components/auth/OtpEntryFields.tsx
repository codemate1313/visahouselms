import type { UseOtpVerificationReturn } from "./useOtpVerification";

export interface OtpEntryStrings {
  otpExpiresIn: (time: string) => string;
  otpExpired: string;
  otpResendLabel: string;
  otpResendingLabel: string;
  otpResendCooldown: (seconds: number) => string;
}

interface OtpEntryFieldsProps {
  otp: UseOtpVerificationReturn;
  strings: OtpEntryStrings;
  loading: boolean;
}

/**
 * The six-box OTP input row plus the expiry countdown and resend action.
 * Shared by Login and Register so both flows present the identical OTP
 * entry experience instead of two divergent copies.
 */
export function OtpEntryFields({ otp, strings, loading }: OtpEntryFieldsProps) {
  const {
    otpValues,
    otpRefs,
    isExpired,
    timerSeconds,
    formatTimer,
    resendLoading,
    resendCooldown,
    handleOtpChange,
    handleOtpKeyDown,
    handleOtpPaste,
    handleResendOtp,
  } = otp;

  return (
    <>
      <div className="otp-inputs-wrapper">
        <div className="otp-inputs-container">
          {otpValues.map((val, idx) => (
            <input
              key={idx}
              ref={(el) => {
                otpRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={val}
              onChange={(e) => handleOtpChange(e.target.value, idx)}
              onKeyDown={(e) => handleOtpKeyDown(e, idx)}
              onPaste={handleOtpPaste}
              className={`otp-box-input ${val ? "is-filled" : ""} ${isExpired ? "is-expired" : ""}`}
              autoComplete="one-time-code"
              disabled={loading || isExpired}
              aria-label={`Digit ${idx + 1}`}
              required
            />
          ))}
        </div>
      </div>

      <div className="otp-status-container">
        <div className={`otp-timer-pill ${timerSeconds <= 60 ? "is-warning" : ""} ${isExpired ? "is-expired" : ""}`}>
          <span className="otp-timer-pulse-dot" />
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="otp-timer-text">
            {isExpired ? strings.otpExpired : strings.otpExpiresIn(formatTimer(timerSeconds))}
          </span>
        </div>

        <div className="otp-resend-row">
          <span className="otp-resend-prompt">Didn't receive code?</span>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendLoading || resendCooldown > 0}
            className={`otp-resend-pill-btn ${resendCooldown === 0 && !resendLoading ? "is-active" : ""}`}
          >
            {resendLoading ? (
              <>
                <span className="otp-spin-dot" />
                <span>{strings.otpResendingLabel}</span>
              </>
            ) : resendCooldown > 0 ? (
              <span>{strings.otpResendCooldown(resendCooldown)}</span>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
                <span>{strings.otpResendLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
