export const DEBOUNCE_MS = 800;
export const HEARTBEAT_MS = 5_000;
export const TAB_LEASE_MS = 12_000;
export const IMMERSIVE_MODULE_TYPES = new Set(["full_mock", "final_test"]);

export function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function parseServerTimestamp(value: string): number {
  const hasTimezone = /(?:z|[+-]\d{2}:\d{2})$/i.test(value);
  return new Date(hasTimezone ? value : `${value}Z`).getTime();
}

export type SecurityMediaState = {
  camera: boolean;
  microphone: boolean;
  screen: boolean;
  fullscreen: boolean;
  displaySurface: string | null;
};

export const EMPTY_MEDIA_STATE: SecurityMediaState = {
  camera: false,
  microphone: false,
  screen: false,
  fullscreen: false,
  displaySurface: null,
};

export function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function securityStorageKey(attemptId: string | undefined, name: string): string {
  return `final-test:${attemptId ?? "unknown"}:${name}`;
}

export function storedClientId(attemptId: string | undefined): string {
  const key = securityStorageKey(attemptId, "client-id");
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const value = randomId();
  sessionStorage.setItem(key, value);
  return value;
}
