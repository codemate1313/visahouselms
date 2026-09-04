import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { PageHeader, SegmentedControl } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { formatDate } from "@/utils/date";
import { examNewsStrings as strings } from "./ExamNews.strings";
import "./ExamNews.css";

export interface ExamNewsItem {
  id: number;
  country: string;
  flag: string;
  category: string;
  title: string;
  summary: string;
  published_at: string;
  source_name: string;
  source_url: string;
  tests: string[];
}

const CATEGORY_STYLES: Record<string, { label: string; className: string }> = {
  immigration: { label: "Immigration", className: "cat-immigration" },
  visa: { label: "Visa Policy", className: "cat-visa" },
  study: { label: "Study Abroad", className: "cat-study" },
  exam: { label: "Exam Updates", className: "cat-exam" },
};

function getCategoryInfo(category: string) {
  const normalized = category.toLowerCase();
  return (
    CATEGORY_STYLES[normalized] || {
      label: strings.categories[category as keyof typeof strings.categories] ?? category,
      className: "cat-default",
    }
  );
}

export function ExamNews() {
  const [items, setItems] = useState<ExamNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("ALL");

  useEffect(() => {
    apiClient
      .get<ExamNewsItem[]>("/student/exam-news")
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))),
    [items]
  );

  const visible = useMemo(
    () => (category === "ALL" ? items : items.filter((item) => item.category === category)),
    [items, category]
  );

  return (
    <div className="exam-news-page">
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />

      {loading ? (
        <RouteLoadingState />
      ) : !items.length ? (
        <div className="exam-news-empty">
          <div className="exam-news-empty-icon">📰</div>
          <h3>No Updates Yet</h3>
          <p>{strings.empty}</p>
        </div>
      ) : (
        <div className="exam-news-layout">
          <div className="exam-news-main">
            {categories.length > 1 && (
              <div className="exam-news-filters">
                <SegmentedControl
                  options={[
                    { value: "ALL", label: strings.filterAll },
                    ...categories.map((value) => ({
                      value,
                      label: getCategoryInfo(value).label,
                    })),
                  ]}
                  value={category}
                  onChange={setCategory}
                />
              </div>
            )}

            <div className="exam-news-grid">
              {visible.map((item) => {
                const catInfo = getCategoryInfo(item.category);
                const sourceInitial = item.source_name ? item.source_name.charAt(0).toUpperCase() : "N";

                return (
                  <article className="exam-news-clean-card" id={`news-${item.id}`} key={item.id}>
                    {/* Top Row: Country Badge & Category Pill */}
                    <div className="exam-news-clean-head">
                      <div className="exam-news-clean-country">
                        <span className="exam-news-clean-flag" aria-hidden="true">
                          {item.flag}
                        </span>
                        <span>{item.country}</span>
                      </div>

                      <span
                        className={`exam-news-clean-cat-badge ${catInfo.className}`}
                      >
                        <span className="exam-news-clean-cat-dot" />
                        <span>{catInfo.label}</span>
                      </span>
                    </div>

                    {/* Date Row */}
                    <div className="exam-news-clean-date">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
                    </div>

                    {/* Title */}
                    <h3 className="exam-news-clean-title">
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="exam-news-clean-title-link"
                      >
                        {item.title}
                      </a>
                    </h3>

                    {/* Summary */}
                    <p className="exam-news-clean-summary">{item.summary}</p>

                    {/* Test Tags */}
                    {item.tests && item.tests.length > 0 && (
                      <div className="exam-news-clean-tests">
                        {item.tests.map((test) => (
                          <span className="exam-news-clean-test-chip" key={test}>
                            {test}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer Row (Source Profile & Read More Action Button) */}
                    <div className="exam-news-clean-footer">
                      <div className="exam-news-clean-source">
                        <div
                          className={`exam-news-clean-source-avatar ${catInfo.className}`}
                        >
                          {sourceInitial}
                        </div>
                        <div className="exam-news-clean-source-meta">
                          <span className="exam-news-clean-source-name">{item.source_name}</span>
                          <span className="exam-news-clean-source-label">Official Source</span>
                        </div>
                      </div>

                      <a
                        className="exam-news-clean-read-btn"
                        href={item.source_url}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        <span>Read more</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M7 17L17 7M17 7H7M17 7V17" />
                        </svg>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Sidebar: Live Timeline Updates */}
          <aside className="exam-news-sidebar">
            <div className="exam-news-sidebar-head">
              <div className="exam-news-sidebar-title-group">
                <span className="exam-news-sidebar-live-dot" />
                <h3>{strings.sidebarHeading}</h3>
              </div>
              <span className="exam-news-sidebar-badge">{strings.sidebarHint}</span>
            </div>

            <ol className="exam-news-timeline">
              {items.map((item) => (
                <li className="exam-news-timeline-item" key={item.id}>
                  <a href={`#news-${item.id}`} className="exam-news-timeline-link">
                    <div className="exam-news-timeline-date-row">
                      <span className="exam-news-timeline-flag" aria-hidden="true">
                        {item.flag}
                      </span>
                      <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
                    </div>
                    <span className="exam-news-timeline-title">{item.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
