/**
 * Client side of the traffic beacon.
 *
 * Reports a page view on every route change and, optionally, a named click.
 * Deliberately fire-and-forget and deliberately quiet: analytics must never
 * interfere with the page the visitor is actually using, so a failed beacon is
 * swallowed and nothing here can throw into a render.
 *
 * The visitor id is a random token kept in localStorage. It exists only to
 * count unique visitors and is tied to no account or identity; a visitor who
 * clears storage simply counts as new.
 */
const VISITOR_KEY = "vh-visitor-id";
const COLLECT_PATH = "/platform/collect";

function apiBase(): string {
  // Matches the axios client's base without importing it, so the beacon has no
  // dependency on the app's request stack and cannot be caught by its
  // interceptors or its auth handling.
  return (import.meta.env.VITE_API_BASE_URL as string) || "/api";
}

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        (crypto?.randomUUID?.() ??
          `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).slice(0, 64);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // Private-mode or storage disabled: still report, just always as "new".
    return "anonymous";
  }
}

function send(body: Record<string, unknown>): void {
  try {
    const url = `${apiBase()}${COLLECT_PATH}`;
    const payload = JSON.stringify(body);
    // sendBeacon survives a page unload, which a fetch mid-navigation may not.
    if (navigator?.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "include",
    }).catch(() => undefined);
  } catch {
    // Never let telemetry surface to the user.
  }
}

/** One page view for the given path. */
export function trackPageView(path: string, referrer?: string): void {
  send({
    event_type: "pageview",
    path: path.slice(0, 500),
    referrer: (referrer ?? document.referrer ?? "").slice(0, 500) || undefined,
    visitor_id: visitorId(),
  });
}

/** One named click, e.g. a call-to-action button. */
export function trackClick(label: string, path?: string): void {
  send({
    event_type: "click",
    path: (path ?? window.location.pathname).slice(0, 500),
    label: label.slice(0, 120),
    visitor_id: visitorId(),
  });
}
