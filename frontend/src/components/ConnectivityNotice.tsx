import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/client";
import "./ConnectivityNotice.css";

/** How long a probe may hang before the connection counts as lost. A request
    that never answers is indistinguishable from no connection at all, and the
    candidate should not wait on a spinner to be told so. */
const PROBE_TIMEOUT_MS = 6000;
/** Poll while connected, to catch a link that drops without the browser
    noticing, and while disconnected, so the notice clears itself the moment the
    network is back rather than waiting for the button to be pressed. */
const ONLINE_POLL_MS = 25_000;
const OFFLINE_POLL_MS = 5000;

/**
 * Reaches the server, rather than trusting `navigator.onLine`.
 *
 * `navigator.onLine` reports the link, not the internet: a laptop joined to a
 * router with no upstream reports itself online, and every request then fails
 * for reasons the app cannot explain. Any HTTP answer at all - including a 500
 * - proves the path works, so only a rejected or timed-out request counts as
 * disconnected.
 */
async function probeConnection(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${API_BASE_URL}/health?probe=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

/**
 * Full-screen notice shown when the connection to the platform is lost.
 *
 * It blocks the app deliberately: with no connection nothing saves, and an
 * answer typed into a dead page is an answer lost. The notice clears itself as
 * soon as a probe succeeds, so a connection that returns on its own needs no
 * action - the button is for the candidate who has just fixed their Wi-Fi and
 * would rather not wait for the next poll.
 */
export function ConnectivityNotice() {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);
  /** Set once a recheck has come back still disconnected, so the notice can say
      so instead of silently looking as though the button did nothing. */
  const [recheckFailed, setRecheckFailed] = useState(false);
  const aliveRef = useRef(true);
  const checkingRef = useRef(false);
  const recheckButtonRef = useRef<HTMLButtonElement | null>(null);

  const check = useCallback(async (manual = false) => {
    if (checkingRef.current) return;
    // A background tab is throttled and cannot act on the answer anyway, so
    // polling one is traffic spent for nothing. A manual press is always
    // honoured - the tab is plainly in front of someone.
    if (!manual && typeof document !== "undefined" && document.hidden) return;
    checkingRef.current = true;
    if (manual) {
      setChecking(true);
      setRecheckFailed(false);
    }
    const connected = await probeConnection();
    checkingRef.current = false;
    if (!aliveRef.current) return;
    setOffline(!connected);
    if (manual) {
      setChecking(false);
      setRecheckFailed(!connected);
    }
    if (connected) setRecheckFailed(false);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    // The browser's own events are the fastest signal available, but only the
    // probe decides: `online` fires when the link comes back, which is not the
    // same as the internet being reachable again.
    const handleOffline = () => setOffline(true);
    const handleOnline = () => void check();
    // Coming back to a tab that was hidden while the connection dropped: check
    // before the candidate types into a page that cannot save.
    const handleVisibility = () => { if (!document.hidden) void check(); };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    void check();
    return () => {
      aliveRef.current = false;
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [check]);

  useEffect(() => {
    const timer = window.setInterval(() => void check(), offline ? OFFLINE_POLL_MS : ONLINE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [check, offline]);

  useEffect(() => {
    if (offline) recheckButtonRef.current?.focus();
  }, [offline]);

  if (!offline) return null;

  return (
    <ConnectivityNoticeDialog
      checking={checking}
      recheckFailed={recheckFailed}
      recheckButtonRef={recheckButtonRef}
      onRecheck={() => void check(true)}
    />
  );
}

interface ConnectivityNoticeDialogProps {
  checking: boolean;
  recheckFailed: boolean;
  onRecheck: () => void;
  recheckButtonRef?: React.Ref<HTMLButtonElement>;
}

/** The notice itself, with no opinion about the network - split out so both of
    its states can be seen in Storybook without unplugging anything. */
export function ConnectivityNoticeDialog({ checking, recheckFailed, onRecheck, recheckButtonRef }: ConnectivityNoticeDialogProps) {
  return (
    <div
      className="connectivity-notice"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="connectivity-notice-title"
      aria-describedby="connectivity-notice-body"
    >
      <div className="connectivity-notice-card">
        <div className="connectivity-notice-mark" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1l22 22" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <path d="M12 20h.01" />
          </svg>
        </div>
        <h1 id="connectivity-notice-title">No internet connection</h1>
        <p id="connectivity-notice-body">
          {recheckFailed
            ? "Still no connection. Check your Wi-Fi or mobile data, then try again."
            : "You are offline, so nothing can be saved right now. Reconnect and this will clear on its own."}
        </p>
        <button
          type="button"
          ref={recheckButtonRef}
          className="connectivity-notice-button"
          onClick={onRecheck}
          disabled={checking}
        >
          {checking ? "Checking connection..." : "Recheck connection"}
        </button>
      </div>
    </div>
  );
}
