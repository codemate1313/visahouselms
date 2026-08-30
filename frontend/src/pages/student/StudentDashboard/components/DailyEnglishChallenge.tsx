import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { DashboardButton } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";
import "./DailyEnglishChallenge.css";

interface EnglishFact {
  page_id: number;
  title: string;
  fact: string;
  image_url: string;
  source_url: string;
  source_name: string;
}

interface DailyQuestion {
  id: string;
  category: string;
  prompt: string;
  options: string[];
  selected_answer: number | null;
  is_correct: boolean | null;
  correct_answer: number | null;
  explanation: string | null;
}

interface ChallengeActivity {
  date: string;
  completed: boolean;
  answered_count: number;
  score: number;
}

interface DailyChallenge {
  date: string;
  questions: DailyQuestion[];
  answered_count: number;
  total_questions: number;
  score: number;
  completed: boolean;
  current_streak: number;
  longest_streak: number;
  activity: ChallengeActivity[];
}

/**
 * The animated streak flame. Rendered at full size on the result view and as a
 * compact button in the facts view, so the fire stays visible while a student
 * browses discovery facts.
 */
function StreakFlame({ sparkCount, label }: { sparkCount: number; label: string }) {
  return (
    <span className="daily-completion-fire" aria-label={label}>
      <span className="daily-fire-halo" />
      <svg
        className="daily-fire-svg"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="fireOuterGrad" x1="32" y1="60" x2="32" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="45%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="fireInnerGrad" x1="32" y1="58" x2="32" y2="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="60%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#fef08a" />
          </linearGradient>
          <linearGradient id="fireCoreGrad" x1="32" y1="56" x2="32" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="70%" stopColor="#ffffff" />
          </linearGradient>
        </defs>

        {/* Outer Flame Silhouette */}
        <path
          className="flame-outer"
          d="M32 4C32 4 23 16.5 21 27.5C20.2 31.9 21.6 35.8 23.5 39C24.5 34.5 27.5 30.5 31 28C30.2 32.5 32 37.5 36.5 39.5C36 34.5 38 29.5 42 26C41.2 31 43.5 36.5 45.5 38.5C48.2 33.5 48.5 27 45 20C40.5 11 32 4 32 4Z"
          fill="url(#fireOuterGrad)"
        />

        {/* Base Flame Body */}
        <path
          className="flame-body"
          d="M17 38C17 48 23.7 58 32 58C40.3 58 47 48 47 38C47 34.5 45.8 31 44 28C42 34 37 38 32 38C27 38 22 34 20 28C18.2 31 17 34.5 17 38Z"
          fill="url(#fireOuterGrad)"
        />

        {/* Inner Flame Tongue */}
        <path
          className="flame-inner"
          d="M32 18C32 18 25 28 25 38C25 45.7 28.1 52 32 52C35.9 52 39 45.7 39 38C39 28 32 18 32 18Z"
          fill="url(#fireInnerGrad)"
        />

        {/* Glowing Core */}
        <path
          className="flame-core"
          d="M32 32C32 32 28 38 28 44C28 48.4 29.8 51 32 51C34.2 51 36 48.4 36 44C36 38 32 32 32 32Z"
          fill="url(#fireCoreGrad)"
        />
      </svg>
      <span className="daily-fire-sparks" aria-hidden="true">
        {Array.from({ length: sparkCount }, (_, index) => (
          <i
            key={index}
            style={{
              "--spark-index": index,
              "--spark-x": `${(index - (sparkCount - 1) / 2) * 8}px`,
              "--spark-rotate": `${(index - (sparkCount - 1) / 2) * 14}deg`,
            } as CSSProperties}
          />
        ))}
      </span>
    </span>
  );
}

function PracticeActivity({ activity }: { activity: ChallengeActivity[] }) {
  const t = strings.dailyEnglish;
  return (
    <aside className="daily-activity-area">
      <div className="daily-activity-box">
        <div className="daily-activity-heading">
          <h3>{t.activityHeading}</h3>
          <span>{t.weeks}</span>
        </div>
        <div className="daily-activity-grid" aria-label={t.activityHeading}>
          {activity.map((day) => (
            <span
              className={`daily-activity-day${day.completed ? " is-complete" : day.answered_count ? " is-partial" : ""}`}
              data-tooltip={t.activityTooltip(day.date, day.answered_count, day.score)}
              key={day.date}
            />
          ))}
        </div>
        <div className="daily-activity-legend">
          <span>{t.less}</span>
          <i />
          <i className="is-partial" />
          <i className="is-complete" />
          <span>{t.more}</span>
        </div>
      </div>
    </aside>
  );
}

export function DailyEnglishChallenge() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFacts, setShowFacts] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
  const [facts, setFacts] = useState<EnglishFact[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);
  const [failedImageId, setFailedImageId] = useState<number | null>(null);
  const t = strings.dailyEnglish;

  useEffect(() => {
    apiClient.get<DailyChallenge>("/student/daily-english")
      .then(({ data }) => {
        setChallenge(data);
        const firstOpen = data.questions.findIndex((question) => question.selected_answer === null);
        setActiveIndex(firstOpen >= 0 ? firstOpen : data.questions.length - 1);
      })
      .catch((err: unknown) => setError(extractErrorMessage(err, t.loadError)));
  }, [t.loadError]);

  // Load exactly 5 facts sequentially to avoid duplicate random entries
  useEffect(() => {
    const fetchDiscoveryFacts = async () => {
      setFactsLoading(true);
      const loadedFacts: EnglishFact[] = [];
      const excludedIds: number[] = [];
      for (let i = 0; i < 5; i++) {
        try {
          const excludeParam = excludedIds.join(",");
          const { data } = await apiClient.get<EnglishFact>("/student/english-discovery", {
            params: excludeParam ? { exclude_page_ids: excludeParam } : undefined,
          });
          loadedFacts.push(data);
          excludedIds.push(data.page_id);
        } catch (e) {
          console.error(`Failed to load fact #${i + 1}`, e);
        }
      }
      setFacts(loadedFacts);
      setFactsLoading(false);
    };
    fetchDiscoveryFacts();
  }, []);

  const activeQuestion = challenge?.questions[activeIndex] ?? null;
  const calendarLabel = useMemo(
    () => challenge
      ? new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric" }).format(new Date(`${challenge.date}T00:00:00`))
      : "",
    [challenge],
  );

  async function answer(answerIndex: number) {
    if (!activeQuestion || activeQuestion.selected_answer !== null) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.post<DailyChallenge>("/student/daily-english/answer", {
        question_id: activeQuestion.id,
        answer_index: answerIndex,
      });
      setChallenge(data);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.answerError));
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !challenge) {
    return <p className="error-text">{error}</p>;
  }
  if (!challenge || !activeQuestion) {
    return <section className="workspace-panel daily-english-panel"><p>{t.loading}</p></section>;
  }

  const answered = activeQuestion.selected_answer !== null;
  const fireLevel = challenge.score >= 4 ? "high" : challenge.score >= 2 ? "medium" : "low";
  const sparkCount = Math.max(3, challenge.score * 2);
  const isCompletedView = challenge.completed && !reviewing;

  return (
    <div className={`daily-english-panel${isCompletedView ? ` daily-completion is-${fireLevel}` : ""}`}>
      <div className="daily-english-header">
        <div>
          <span className="daily-english-eyebrow">
            {isCompletedView && showFacts ? "English Discovery" : t.eyebrow}
          </span>
          <h2>
            {isCompletedView
              ? showFacts
                ? `English Fact #${factIndex + 1}`
                : t.completedHeading
              : t.heading}
          </h2>
          <p>
            {isCompletedView
              ? showFacts
                ? "A fact while you keep learning"
                : t.completedMessage
              : t.subtitle(calendarLabel)}
          </p>
        </div>
        <div className="daily-streak-stats">
          <div className="daily-streak-card">
            <span>{t.currentStreak}</span>
            <div className="daily-flip-counter" aria-label={`Current streak: ${challenge.current_streak}`}>
              {(challenge.current_streak >= 10 ? String(challenge.current_streak) : `0${challenge.current_streak}`).split("").map((digit, i) => (
                <span className="daily-flip-digit" key={i}>{digit}</span>
              ))}
            </div>
          </div>
          <div className="daily-streak-card">
            <span>{t.longestStreak}</span>
            <div className="daily-flip-counter" aria-label={`Longest streak: ${challenge.longest_streak}`}>
              {(challenge.longest_streak >= 10 ? String(challenge.longest_streak) : `0${challenge.longest_streak}`).split("").map((digit, i) => (
                <span className="daily-flip-digit" key={i}>{digit}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="daily-english-layout">
        {isCompletedView ? (
          showFacts ? (
            <div className="daily-facts-summary">
              <div className="daily-fact-card">
                <div className="daily-fact-content">
                  {facts[factIndex] ? (
                    <>
                      <a
                        className={`daily-fact-image-link${failedImageId === facts[factIndex].page_id ? " is-unavailable" : ""}`}
                        href={facts[factIndex].source_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {failedImageId !== facts[factIndex].page_id && (
                          <img
                            alt=""
                            onError={() => setFailedImageId(facts[factIndex].page_id)}
                            src={facts[factIndex].image_url}
                          />
                        )}
                        {failedImageId === facts[factIndex].page_id && <span>{facts[factIndex].title.charAt(0)}</span>}
                      </a>
                      <div className="daily-fact-text">
                        <h4>{facts[factIndex].title}</h4>
                        <p>{facts[factIndex].fact}</p>
                        <a
                          href={facts[factIndex].source_url}
                          rel="noreferrer"
                          target="_blank"
                          className="wiki-redirect-link"
                        >
                          Read on Wikipedia
                        </a>
                      </div>
                    </>
                  ) : factsLoading ? (
                    <div className="daily-facts-loading">
                      <span className="ui-btn-spinner" aria-hidden="true" />
                      <span>Loading facts...</span>
                    </div>
                  ) : (
                    <div className="daily-facts-loading">
                      <span>No facts available today.</span>
                    </div>
                  )}
                </div>
                {facts.length > 0 && (
                  <div className="daily-fact-nav-wrapper">
                    <div className="daily-fact-navigation">
                      <IconButton
                        className="daily-fact-nav-btn"
                        onClick={() => {
                          setFailedImageId(null);
                          setFactIndex((idx) => (idx === 0 ? facts.length - 1 : idx - 1));
                        }}
                        label="Previous fact"
                        icon={<Icon name="arrowLeft" />}
                      />
                      <span className="daily-fact-indicator">{factIndex + 1} / {facts.length}</span>
                      <IconButton
                        className="daily-fact-nav-btn"
                        onClick={() => {
                          setFailedImageId(null);
                          setFactIndex((idx) => (idx === facts.length - 1 ? 0 : idx + 1));
                        }}
                        label="Next fact"
                        icon={<Icon name="arrowRight" />}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="daily-completion-actions">
                <DashboardButton onClick={() => setShowFacts(false)} variant="secondary">
                  <Icon name="arrowLeft" /> Back to Result
                </DashboardButton>
              </div>
            </div>
          ) : (
            <div className="daily-completion-card">
              <div className="daily-completion-badge-wrap">
                <div className="daily-flame-aura">
                  <StreakFlame label={t.fireLabel(challenge.score)} sparkCount={sparkCount} />
                </div>
                <div className="daily-completion-details">
                  <div className="daily-completion-score-row">
                    <h3 className="daily-completion-score-text">
                      {challenge.score} of {challenge.total_questions} Correct
                    </h3>
                    <span className="daily-accuracy-simple">
                      • {Math.round((challenge.score / challenge.total_questions) * 100)}% accuracy
                    </span>
                  </div>
                  <p className="daily-completion-subtext">Daily English challenge completed for today</p>
                </div>
              </div>

              <div className="daily-completion-actions">
                <div className="completion-btn-row">
                  <DashboardButton
                    leftIcon={<Icon name="eye" />}
                    onClick={() => {
                      setActiveIndex(0);
                      setReviewing(true);
                    }}
                    variant="secondary"
                  >
                    {t.reviewAnswers}
                  </DashboardButton>
                  <DashboardButton
                    rightIcon={<Icon name="arrowRight" />}
                    onClick={() => {
                      setFactIndex(0);
                      setShowFacts(true);
                    }}
                  >
                    Next
                  </DashboardButton>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="daily-question-area">
          <div className="daily-progress-row">
            <span>{t.questionProgress(activeIndex + 1, challenge.total_questions)}</span>
            <strong>{challenge.answered_count}/{challenge.total_questions}</strong>
          </div>
          <div className="daily-progress-track" aria-hidden="true">
            <span style={{ width: `${(challenge.answered_count / challenge.total_questions) * 100}%` }} />
          </div>

          <span className="daily-question-category">{activeQuestion.category}</span>
          <h3>{activeQuestion.prompt}</h3>
          <div className="daily-answer-grid">
            {activeQuestion.options.map((option, index) => {
              const isSelected = activeQuestion.selected_answer === index;
              const isCorrect = answered && activeQuestion.correct_answer === index;
              const isWrong = answered && isSelected && !activeQuestion.is_correct;
              return (
                <button
                  className={`daily-answer-option${isCorrect ? " is-correct" : ""}${isWrong ? " is-wrong" : ""}`}
                  disabled={answered || submitting}
                  key={option}
                  onClick={() => void answer(index)}
                  type="button"
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {option}
                </button>
              );
            })}
          </div>

          {answered && (
            <div
              className={`daily-answer-feedback ${activeQuestion.is_correct ? "is-correct" : "is-wrong"}`}
              role="status"
            >
              <strong>{activeQuestion.is_correct ? t.correct : t.incorrect}</strong>
              <p>{activeQuestion.explanation}</p>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}

          <div className="daily-question-navigation">
            <DashboardButton
              disabled={activeIndex === 0}
              leftIcon={<Icon name="arrowLeft" />}
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
              variant="secondary"
            >
              {t.previous}
            </DashboardButton>
            {answered && activeIndex < challenge.questions.length - 1 && (
              <DashboardButton
                onClick={() => setActiveIndex((index) => Math.min(challenge.questions.length - 1, index + 1))}
                rightIcon={<Icon name="arrowRight" />}
              >
                {t.next}
              </DashboardButton>
            )}
            {challenge.completed && activeIndex === challenge.questions.length - 1 && (
              <span className="daily-complete-label">
                <Icon name="check" /> {t.complete(challenge.score, challenge.total_questions)}
              </span>
            )}
            {challenge.completed && reviewing && (
              <DashboardButton onClick={() => setReviewing(false)} variant="secondary">
                {t.backToResult}
              </DashboardButton>
            )}
          </div>
        </div>
        )}

        <PracticeActivity activity={challenge.activity} />
      </div>
    </div>
  );
}
