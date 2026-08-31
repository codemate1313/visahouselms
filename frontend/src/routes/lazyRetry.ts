import { lazy, type ComponentType } from "react";

/**
 * Route components are code-split, so every navigation fetches a chunk. Two
 * things break that fetch, and both land on a student mid-exam:
 *
 *  - a network blip, which a retry a moment later fixes; and
 *  - a deployment, after which the hashed filenames this tab was built against
 *    no longer exist, and no retry of the same URL will ever succeed - only a
 *    reload, which picks up the new index.html and its new hashes.
 *
 * So the import is retried a couple of times here, and the route error
 * boundary reloads the page once if it still fails.
 */

const RETRY_DELAYS_MS = [350, 1200];

/** Every browser words a failed module fetch differently. */
const CHUNK_ERROR_PATTERNS = [
  "Failed to fetch dynamically imported module", // Chrome, Edge
  "error loading dynamically imported module", // Firefox
  "Importing a module script failed", // Safari
  "Failed to load module script", // Chrome, wrong MIME on a 404 page
  "Unable to preload CSS", // Vite's own preload helper
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
];

function messageOf(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === "object" && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error ?? "");
}

export function isChunkLoadFailure(error: unknown): boolean {
  const message = messageOf(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function loadWithRetry<T>(load: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await load();
    } catch (error) {
      // A page that is genuinely broken should fail fast and loudly; only a
      // failed fetch is worth waiting on.
      if (!isChunkLoadFailure(error)) throw error;
      lastError = error;
      if (attempt < RETRY_DELAYS_MS.length) await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

/** `React.lazy`, but a transient network failure does not lose the page. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRoute<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => loadWithRetry(load));
}
