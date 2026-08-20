export const DEBOUNCE_MS = 800;
export const HEARTBEAT_MS = 5_000;
export const TAB_LEASE_MS = 12_000;
/** Grace after the secure session goes live before browser events count as
 *  violations. The screen-sharing notification takes focus as sharing starts,
 *  which blurs the page through no fault of the candidate. */
export const PROCTOR_SETTLE_MS = 1_500;
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
  fullscreen: boolean;
};

export const EMPTY_MEDIA_STATE: SecurityMediaState = {
  camera: false,
  microphone: false,
  fullscreen: false,
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

/**
 * The Final Test is sat in the official LanguageCert / PeopleCert exam skin,
 * so its runner chrome is rebuilt to match the live delivery platform. Every
 * other module type keeps the standard engine look, which is why this is keyed
 * strictly on `final_test` rather than on `is_final` or the immersive set.
 */
export function usesLanguageCertSkin(moduleType?: string | null): boolean {
  return moduleType === "final_test";
}

/** Title shown in the middle of the exam header, e.g. "LanguageCert Academic Test (Reading)". */
export function languageCertHeaderTitle(sectionType: string): string {
  const labels: Record<string, string> = {
    listening: "Listening",
    reading: "Reading",
    writing: "Writing",
    speaking: "Speaking",
  };
  const label = labels[sectionType] ?? sectionType;
  return sectionType === "speaking"
    ? "LanguageCert Academic Speaking"
    : `LanguageCert Academic Test (${label})`;
}

/**
 * Modules that sit Reading and Writing against one shared countdown.
 *
 * Both composite papers work the same way: the attempt carries a single
 * server-side deadline, and Reading and Writing are worked through under it as
 * one block rather than getting an allowance each.
 */
export const COMBINED_TIMER_MODULE_TYPES = new Set(["final_test", "full_mock"]);

/** The only sections that display that countdown. */
const TIMED_SECTION_TYPES = new Set(["reading", "writing"]);

/**
 * Whether the countdown is shown while this part is open.
 *
 * Listening is paced by its recording and Speaking by the examiner, so on those
 * papers a clock tells the candidate nothing they can act on and only invites
 * them to rush an answer they do not control the timing of. It stays hidden
 * there and appears across Reading and Writing, which are the sections the
 * candidate actually paces themselves.
 *
 * Every other module type is unaffected and keeps its timer throughout.
 */
export function showsSectionTimer(moduleType: string | null | undefined, sectionType: string): boolean {
  if (!moduleType || !COMBINED_TIMER_MODULE_TYPES.has(moduleType)) return true;
  return TIMED_SECTION_TYPES.has(sectionType);
}

/**
 * The candidate reference shown on the Final Test's verification screen.
 *
 * Derived from the attempt rather than stored, so it is stable for the life of
 * the sitting - the same attempt reads back the same reference after a reload -
 * and distinct between sittings, because the attempt id is part of the seed.
 *
 * It is a display reference for the exam paperwork, not a number issued by an
 * awarding body; nothing is validated against it.
 */
export function buildExamUrn(
  attempt: { id: number; started_at: string },
  userId: number | undefined,
): string {
  const seed = `${attempt.id}:${userId ?? 0}:${attempt.started_at}`;

  // FNV-1a: small, deterministic, and dependency-free. Not a security hash -
  // nothing here needs to resist an attacker, only to stay put across renders.
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  let digits = "";
  let state = hash;
  while (digits.length < 22) {
    state = (Math.imul(state, 0x01000193) ^ (digits.length + 1)) >>> 0;
    digits += String(state).padStart(10, "0").slice(-10);
  }

  const started = new Date(parseServerTimestamp(attempt.started_at));
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = Number.isNaN(started.getTime())
    ? "000000"
    : `${pad(started.getDate())}${pad(started.getMonth() + 1)}${pad(started.getFullYear() % 100)}`;

  return `LCA/${stamp}/${digits.slice(0, 22)}`;
}

/** `dd/mm/yyyy` for the verification screen, or an em dash when unknown. */
export function formatExamBirthDate(dob: string | null | undefined): string {
  if (!dob) return "—";
  const parsed = new Date(dob.length <= 10 ? `${dob}T00:00:00Z` : dob);
  if (Number.isNaN(parsed.getTime())) return "—";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(parsed.getUTCDate())}/${pad(parsed.getUTCMonth() + 1)}/${parsed.getUTCFullYear()}`;
}

/**
 * Minutes allocated to the Reading and Writing parts, added together.
 *
 * This is what the countdown on a Final Test or Full Mock shows: the block's
 * own allowance, taken from the parts as the module author set them, rather
 * than whatever is left of the whole attempt. Returns null when no part in
 * either section carries a duration, so the caller can fall back to the
 * attempt clock rather than count down from zero.
 */
export function combinedTimedSectionMinutes(
  parts: Array<{ section_type: string; duration_minutes: number | null }>,
): number | null {
  const total = parts
    .filter((part) => TIMED_SECTION_TYPES.has(part.section_type))
    .reduce((sum, part) => sum + (part.duration_minutes ?? 0), 0);
  return total > 0 ? total : null;
}
