import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { extractErrorMessage } from "@/api/errors";

const OTP_LENGTH = 6;
const EXPIRY_SECONDS = 600; // 10 minutes
const RESEND_COOLDOWN_SECONDS = 30;

export interface OtpResendResponse {
  otp_challenge_id?: string | null;
}

interface UseOtpVerificationOptions {
  /** The active OTP challenge id, or null when no OTP step is in progress. */
  challengeId: string | null;
  /** Performs the resend API call; the hook handles cooldown/timer/focus around it. */
  onResend: () => Promise<OtpResendResponse | void>;
  /** Called when a resend returns a fresh challenge id (the old one may have been consumed). */
  onChallengeIdChange?: (challengeId: string) => void;
  /** Called once a resend request succeeds. */
  onResendSuccess?: () => void;
  /** Called when a resend request fails, with a human-readable message. */
  onResendError?: (message: string) => void;
  resendErrorFallback?: string;
}

/**
 * Shared state/behavior behind the six-box OTP entry UI: per-digit values,
 * paste/backspace handling, the 10-minute expiry countdown, and the 30-second
 * resend cooldown. Used by both Login and Register so the two flows share one
 * implementation instead of drifting apart.
 */
export function useOtpVerification({
  challengeId,
  onResend,
  onChallengeIdChange,
  onResendSuccess,
  onResendError,
  resendErrorFallback = "Unable to resend the code. Please try again.",
}: UseOtpVerificationOptions) {
  const [otpValues, setOtpValues] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [timerSeconds, setTimerSeconds] = useState(EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resendLoading, setResendLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const otpCode = otpValues.join("");
  const isExpired = timerSeconds <= 0;

  useEffect(() => {
    if (!challengeId) return;
    setOtpValues(Array(OTP_LENGTH).fill(""));
    setTimerSeconds(EXPIRY_SECONDS);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    const focusTimeout = setTimeout(() => {
      otpRefs.current[0]?.focus();
    }, 50);
    return () => clearTimeout(focusTimeout);
  }, [challengeId]);

  // 10-minute expiry countdown.
  useEffect(() => {
    if (!challengeId || timerSeconds <= 0) return;
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [challengeId, timerSeconds]);

  // Resend cooldown countdown.
  useEffect(() => {
    if (!challengeId || resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [challengeId, resendCooldown]);

  function formatTimer(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function handleOtpChange(value: string, index: number) {
    const cleanValue = value.replace(/\D/g, "");
    if (!cleanValue) {
      const newValues = [...otpValues];
      newValues[index] = "";
      setOtpValues(newValues);
      return;
    }

    const newValues = [...otpValues];
    const val = cleanValue.substring(cleanValue.length - 1);
    newValues[index] = val;
    setOtpValues(newValues);

    if (index < OTP_LENGTH - 1 && val) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace") {
      if (!otpValues[index] && index > 0) {
        const newValues = [...otpValues];
        newValues[index - 1] = "";
        setOtpValues(newValues);
        otpRefs.current[index - 1]?.focus();
      } else {
        const newValues = [...otpValues];
        newValues[index] = "";
        setOtpValues(newValues);
      }
    }
  }

  function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").substring(0, OTP_LENGTH);
    if (pasteData.length === OTP_LENGTH) {
      setOtpValues(pasteData.split(""));
      otpRefs.current[OTP_LENGTH - 1]?.focus();
    }
  }

  async function handleResendOtp() {
    if (resendLoading || resendCooldown > 0) return;
    setResendLoading(true);
    try {
      const data = await onResend();
      if (data?.otp_challenge_id) {
        onChallengeIdChange?.(data.otp_challenge_id);
      }
      setTimerSeconds(EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setOtpValues(Array(OTP_LENGTH).fill(""));
      onResendSuccess?.();
      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 50);
    } catch (err: unknown) {
      onResendError?.(extractErrorMessage(err, resendErrorFallback));
    } finally {
      setResendLoading(false);
    }
  }

  function reset() {
    setOtpValues(Array(OTP_LENGTH).fill(""));
  }

  return {
    otpValues,
    otpCode,
    otpRefs,
    timerSeconds,
    isExpired,
    resendCooldown,
    resendLoading,
    formatTimer,
    handleOtpChange,
    handleOtpKeyDown,
    handleOtpPaste,
    handleResendOtp,
    reset,
  };
}

export type UseOtpVerificationReturn = ReturnType<typeof useOtpVerification>;
