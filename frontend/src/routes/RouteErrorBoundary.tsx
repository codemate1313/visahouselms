import { useEffect, useMemo, useState } from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";

const CHUNK_RELOAD_PREFIX = "vh:chunk-reload:";

function errorText(error: unknown): string {
  if (isRouteErrorResponse(error)) {
    return `${error.status} ${error.statusText} ${JSON.stringify(error.data ?? "")}`;
  }
  if (error instanceof Error) {
    return `${error.name} ${error.message}`;
  }
  return String(error ?? "");
}

function isStaleChunkError(error: unknown): boolean {
  const message = errorText(error);
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to load module script")
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const [refreshing, setRefreshing] = useState(false);
  const staleChunk = isStaleChunkError(error);
  const reloadKey = useMemo(
    () => `${CHUNK_RELOAD_PREFIX}${window.location.pathname}${window.location.search}`,
    [],
  );

  useEffect(() => {
    if (!staleChunk) return;
    if (sessionStorage.getItem(reloadKey) === "1") return;

    sessionStorage.setItem(reloadKey, "1");
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
          <h1>Updating app...</h1>
          <p>Loading the latest dashboard files.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="route-error-page" role="alert">
      <section>
        <h1>{staleChunk ? "App updated" : "Something went wrong"}</h1>
        <p>
          {staleChunk
            ? "The dashboard files changed while this browser tab was open. Refresh once to continue."
            : "The page could not be loaded. Please try again."}
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </section>
    </main>
  );
}
