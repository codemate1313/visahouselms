import { useEffect, useMemo, useState } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/Button/Button";
import { isChunkLoadFailure } from "./lazyRetry";

const CHUNK_RELOAD_PREFIX = "vh:chunk-reload:";
/** How long one automatic reload suppresses the next for the same page. Long
 *  enough to stop a reload loop, short enough that a deployment an hour later
 *  still gets its own recovery instead of a dead end. */
const RELOAD_COOLDOWN_MS = 30_000;

function isStaleChunkError(error: unknown): boolean {
  // An HTTP response the router itself produced is a real error from the
  // server, never a chunk that failed to download.
  if (isRouteErrorResponse(error)) return false;
  return isChunkLoadFailure(error);
}

/** True while the student is inside a running attempt. */
function isExamRoute(): boolean {
  return /^\/student\/attempts\/\d+\/take$/.test(window.location.pathname);
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const [refreshing, setRefreshing] = useState(false);
  const staleChunk = isStaleChunkError(error);
  const inExam = isExamRoute();
  const reloadKey = useMemo(
    () => `${CHUNK_RELOAD_PREFIX}${window.location.pathname}${window.location.search}`,
    [],
  );

  useEffect(() => {
    if (!staleChunk) return;

    // The marker is a timestamp rather than a flag: a reload that did not help
    // must not suppress the recovery for the rest of the session.
    const previous = Number(sessionStorage.getItem(reloadKey) ?? 0);
    if (previous && Date.now() - previous < RELOAD_COOLDOWN_MS) return;

    sessionStorage.setItem(reloadKey, String(Date.now()));
    setRefreshing(true);
    window.location.reload();
  }, [reloadKey, staleChunk]);

  useEffect(() => {
    if (staleChunk) return;
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith(CHUNK_RELOAD_PREFIX))
      .forEach((key) => sessionStorage.removeItem(key));
  }, [staleChunk]);

  if (staleChunk && refreshing) {
    return (
      <main className="route-error-page" role="status" aria-live="polite">
        <section>
          <h1>Reconnecting...</h1>
          <p>
            {inExam
              ? "Loading the page again. Your answers are saved and your test carries on from where you left it."
              : "Loading the latest dashboard files."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="route-error-page" role="alert">
      <section>
        <h1>{staleChunk ? "Connection interrupted" : "Something went wrong"}</h1>
        <p>
          {staleChunk
            ? inExam
              ? "This page could not be downloaded - usually a brief drop in connection, or an update released while your test was open. Refresh to continue; your answers are saved and the test resumes where you left it."
              : "The page files could not be downloaded. Refresh once to continue."
            : inExam
              ? "This page could not be loaded. Refresh to continue - your answers are saved and the test resumes where you left it."
              : "The page could not be loaded. Please try again."}
        </p>
        <Button type="button" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </section>
    </main>
  );
}
