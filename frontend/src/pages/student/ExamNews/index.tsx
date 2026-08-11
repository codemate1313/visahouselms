import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { Badge, PageHeader, SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
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

const CATEGORY_TONE = {
  immigration: "green",
  visa: "blue",
  study: "amber",
  exam: "gray",
} as const;

function categoryLabel(category: string): string {
  return strings.categories[category as keyof typeof strings.categories] ?? category;
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
    [items],
  );

  const visible = useMemo(
    () => (category === "ALL" ? items : items.filter((item) => item.category === category)),
    [items, category],
  );

  return (
    <div className="exam-news-page">
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />

      {loading ? (
        <p className="hint">{strings.loading}</p>
      ) : !items.length ? (
        <p className="empty-message">{strings.empty}</p>
      ) : (
        <div className="exam-news-layout">
          <div className="exam-news-main">
            {categories.length > 1 && (
              <SegmentedControl
                options={[
                  { value: "ALL", label: strings.filterAll },
                  ...categories.map((value) => ({ value, label: categoryLabel(value) })),
                ]}
                value={category}
                onChange={setCategory}
              />
            )}

            <div className="exam-news-grid">
              {visible.map((item) => (
                <article className="exam-news-card" id={`news-${item.id}`} key={item.id}>
                  <div className="exam-news-card-head">
                    <span className="exam-news-flag" aria-hidden="true">{item.flag}</span>
                    <strong className="exam-news-country">{item.country}</strong>
                    <Badge tone={CATEGORY_TONE[item.category as keyof typeof CATEGORY_TONE] ?? "gray"}>
                      {categoryLabel(item.category)}
                    </Badge>
                  </div>

                  <time className="exam-news-date" dateTime={item.published_at}>
                    <Icon name="due" /> {formatDate(item.published_at)}
                  </time>

                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>

                  <div className="exam-news-tests">
                    {item.tests.map((test) => (
                      <span className="exam-news-test-chip" key={test}>{test}</span>
                    ))}
                  </div>

                  <a
                    className="exam-news-source"
                    href={item.source_url}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    {strings.readFull}
                    <span className="exam-news-source-name">{item.source_name}</span>
                  </a>
                </article>
              ))}
            </div>
          </div>

          <aside className="exam-news-sidebar">
            <div className="exam-news-sidebar-head">
              <h3>{strings.sidebarHeading}</h3>
              <span>{strings.sidebarHint}</span>
            </div>
            <ol className="exam-news-timeline">
              {items.map((item) => (
                <li key={item.id}>
                  <a href={`#news-${item.id}`}>
                    <time className="exam-news-timeline-date" dateTime={item.published_at}>
                      {formatDate(item.published_at)}
                    </time>
                    <span className="exam-news-timeline-title">
                      <span aria-hidden="true">{item.flag}</span> {item.title}
                    </span>
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
