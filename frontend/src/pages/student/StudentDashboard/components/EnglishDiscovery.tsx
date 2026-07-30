import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/ui";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";

interface EnglishFact {
  page_id: number;
  title: string;
  fact: string;
  image_url: string;
  source_url: string;
  source_name: string;
}

const ROTATION_INTERVAL_MS = 3 * 60 * 1000;

export function EnglishDiscovery() {
  const [facts, setFacts] = useState<EnglishFact[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedImageId, setFailedImageId] = useState<number | null>(null);
  const factsRef = useRef<EnglishFact[]>([]);
  const activeIndexRef = useRef(0);
  const loadingRef = useRef(false);
  const t = strings.dailyEnglish.discovery;

  const selectFact = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
    setFailedImageId(null);
  }, []);

  const fetchFact = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const excludedIds = factsRef.current.slice(-20).map((fact) => fact.page_id).join(",");
      const { data } = await apiClient.get<EnglishFact>("/student/english-discovery", {
        params: excludedIds ? { exclude_page_ids: excludedIds } : undefined,
      });
      const existingIndex = factsRef.current.findIndex((fact) => fact.page_id === data.page_id);
      if (existingIndex >= 0) {
        selectFact(existingIndex);
      } else {
        const nextFacts = [...factsRef.current, data];
        factsRef.current = nextFacts;
        setFacts(nextFacts);
        selectFact(nextFacts.length - 1);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.loadError));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [selectFact, t.loadError]);

  const showNext = useCallback(() => {
    const nextIndex = activeIndexRef.current + 1;
    if (nextIndex < factsRef.current.length) {
      selectFact(nextIndex);
      return;
    }
    void fetchFact();
  }, [fetchFact, selectFact]);

  useEffect(() => {
    void fetchFact();
  }, [fetchFact]);

  const currentFact = facts[activeIndex] ?? null;

  useEffect(() => {
    if (!currentFact) return undefined;
    const timer = window.setTimeout(showNext, ROTATION_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [currentFact, showNext]);

  if (!currentFact && loading) {
    return (
      <section className="english-discovery" aria-busy="true">
        <div className="english-discovery-loading">
          <span className="ui-btn-spinner" aria-hidden="true" />
          <span>{t.loading}</span>
        </div>
      </section>
    );
  }

  if (!currentFact) {
    return (
      <section className="english-discovery">
        <div>
          <span className="daily-english-eyebrow">{t.eyebrow}</span>
          <p className="error-text">{error ?? t.loadError}</p>
        </div>
        <IconButton
          icon={<Icon name="restore" />}
          label={t.retry}
          onClick={() => void fetchFact()}
          variant="outline"
        />
      </section>
    );
  }

  return (
    <section className="english-discovery" aria-live="polite">
      <div className="english-discovery-heading">
        <div>
          <span className="daily-english-eyebrow">{t.eyebrow}</span>
          <h3>{t.heading}</h3>
        </div>
        <span className="english-discovery-timer">{t.refreshTime}</span>
      </div>

      <div className="english-discovery-content">
        <a
          className={`english-discovery-image${failedImageId === currentFact.page_id ? " is-unavailable" : ""}`}
          href={currentFact.source_url}
          rel="noreferrer"
          target="_blank"
        >
          {failedImageId !== currentFact.page_id && (
            <img
              alt=""
              onError={() => setFailedImageId(currentFact.page_id)}
              src={currentFact.image_url}
            />
          )}
          {failedImageId === currentFact.page_id && <span>{currentFact.title.charAt(0)}</span>}
        </a>

        <div className="english-discovery-copy">
          <h4>{currentFact.title}</h4>
          <p>{currentFact.fact}</p>
          <a href={currentFact.source_url} rel="noreferrer" target="_blank">
            {t.source(currentFact.source_name)}
          </a>
        </div>

        <div className="english-discovery-controls">
          <IconButton
            disabled={activeIndex === 0}
            icon={<Icon name="arrowLeft" />}
            label={t.previous}
            onClick={() => selectFact(Math.max(0, activeIndex - 1))}
            variant="outline"
          />
          <span>{activeIndex + 1}</span>
          <IconButton
            disabled={loading}
            icon={<Icon name="arrowRight" />}
            label={t.next}
            onClick={showNext}
            variant="solid"
          />
        </div>
      </div>

      <span className="english-discovery-progress" key={currentFact.page_id} aria-hidden="true" />
      {error && <p className="english-discovery-inline-error">{error}</p>}
    </section>
  );
}
