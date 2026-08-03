import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { Badge } from "@/components/ui";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";
import "./ExamNewsPanel.css";

interface ExamNewsItem {
  id: number;
  country: string;
  flag: string;
  category: string;
  title: string;
  summary: string;
  tests: string[];
}

const CATEGORY_TONE = {
  immigration: "green",
  visa: "blue",
  study: "amber",
  exam: "gray",
} as const;

/** Curated exam & immigration updates: which destinations accept IELTS/PTE,
 * score bars, and exam-format changes. Content comes from the backend so it
 * can be updated without redeploying the frontend. */
export function ExamNewsPanel() {
  const t = strings.examNews;
  const [items, setItems] = useState<ExamNewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<ExamNewsItem[]>("/student/exam-news")
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <section className="workspace-panel exam-news-panel">
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2>{t.heading}</h2>
        </div>
      </div>
      {loading ? (
        <p className="hint">{t.loading}</p>
      ) : (
        <div className="exam-news-grid">
          {items.map((item) => (
            <article className="exam-news-card" key={item.id}>
              <div className="exam-news-card-head">
                <span className="exam-news-flag" aria-hidden="true">{item.flag}</span>
                <strong className="exam-news-country">{item.country}</strong>
                <Badge tone={CATEGORY_TONE[item.category as keyof typeof CATEGORY_TONE] ?? "gray"}>
                  {item.category}
                </Badge>
              </div>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="exam-news-tests">
                {item.tests.map((test) => (
                  <span className="exam-news-test-chip" key={test}>{test}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
