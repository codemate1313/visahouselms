import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { PageHeader, SegmentedControl } from "@/components/ui";
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

const CATEGORY_STYLES: Record<string, { label: string; color: string }> = {
  immigration: { label: "Immigration", color: "#10b981" },
  visa: { label: "Visa Policy", color: "#0284c7" },
  study: { label: "Study Abroad", color: "#f59e0b" },
  exam: { label: "Exam Updates", color: "#e11d48" },
};

function getCategoryInfo(category: string) {
  const normalized = category.toLowerCase();
  return (
    CATEGORY_STYLES[normalized] || {
      label: strings.categories[category as keyof typeof strings.categories] ?? category,
      color: "#64748b",
    }
  );
}

/** Exam & immigration news: which destinations accept Language CERT/PTE/TOEFL, the
 * score bars they ask for, and exam-format changes. A sidebar lists every
 * update newest-first; each card links out to the official source. */
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
        <div className="exam-news-loading">
          <div className="exam-news-spinner" />
          <p>{strings.loading}</p>
        </div>
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

                return (
                  <article className="exam-news-card" id={`news-${item.id}`} key={item.id}>
                    {/* Header Row */}
                    <div className="exam-news-card-head">
                      <div className="exam-news-country-group">
                        <span className="exam-news-flag" aria-hidden="true">
                          {item.flag}
                        </span>
                        <strong className="exam-news-country">{item.country}</strong>
                      </div>

                      <div className="exam-news-category-tag">
                        <span
                          className="exam-news-cat-dot"
                          style={{ backgroundColor: catInfo.color }}
                        />
                        <span className="exam-news-cat-label" style={{ color: catInfo.color }}>
                          {catInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Date */}
                    <div className="exam-news-date-row">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
                    </div>

                    {/* Title & Summary */}
                    <h3 className="exam-news-card-title">{item.title}</h3>
                    <p className="exam-news-card-summary">{item.summary}</p>

                    {/* Test tags */}
                    {item.tests && item.tests.length > 0 && (
                      <div className="exam-news-tests">
                        {item.tests.map((test) => (
                          <span className="exam-news-test-chip" key={test}>
                            {test}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Source Link */}
                    <div className="exam-news-card-footer">
                      <a
                        className="exam-news-source-link"
                        href={item.source_url}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        <div className="exam-news-source-info">
                          <span className="exam-news-source-label">Official Source</span>
                          <span className="exam-news-source-name">{item.source_name}</span>
                        </div>
                        <svg
                          className="exam-news-source-arrow"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                        >
                          <path d="M7 17L17 7M17 7H7M17 7V17" />
                        </svg>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
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
