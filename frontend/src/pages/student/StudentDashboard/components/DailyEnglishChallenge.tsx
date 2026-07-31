import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { DashboardButton } from "@/components/ui";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";
import "./DailyEnglishChallenge.css";

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

function PracticeActivity({ activity }: { activity: ChallengeActivity[] }) {
  const t = strings.dailyEnglish;
  return (
    <aside className="daily-activity-area">
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
    </aside>
  );
}

const LOCAL_FACTS = [
  {
    title: "Shortest Sentence",
    content: "The shortest complete sentence in the English language is 'I am.' It contains a subject (I) and a verb (am) to express a complete thought.",
    icon: "help" as const,
  },
  {
    title: "Pangram Sentences",
    content: "A pangram is a sentence that contains every letter in the alphabet. The most famous example is: 'The quick brown fox jumps over the lazy dog.'",
    icon: "courses" as const,
  },
  {
    title: "The Most Common Word",
    content: "The word 'the' is the most common word in the English language. It represents about 5% of all written and spoken words.",
    icon: "search" as const,
  },
  {
    title: "Crutch Words",
    content: "Words like 'like', 'literally', 'actually', and 'basically' are called 'crutch words'. We repeat them out of habit without adding any value.",
    icon: "logs" as const,
  },
  {
    title: "Shakespeare's Vocabulary",
    content: "William Shakespeare is credited with inventing over 1,700 words, including 'lonely', 'bedroom', 'fashionable', 'eyeball', and 'swagger'.",
    icon: "admin" as const,
  },
];

export function DailyEnglishChallenge() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFacts, setShowFacts] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
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

  if (challenge.completed && !reviewing) {
    const sparkCount = Math.max(3, challenge.score * 2);
    return (
      <section className={`workspace-panel daily-english-panel daily-completion is-${fireLevel}`}>
        <div className="daily-completion-layout">
          {showFacts ? (
            <div className="daily-facts-summary">
              <div className="daily-facts-header">
                <span className="daily-english-eyebrow">English Discovery</span>
                <h2>English Fact #{factIndex + 1}</h2>
              </div>
              <div className="daily-fact-card">
                <div className="daily-fact-content">
                  <div className="daily-fact-icon-wrapper">
                    <Icon name={LOCAL_FACTS[factIndex].icon} />
                  </div>
                  <div className="daily-fact-text">
                    <h4>{LOCAL_FACTS[factIndex].title}</h4>
                    <p>{LOCAL_FACTS[factIndex].content}</p>
                  </div>
                </div>
                <div className="daily-fact-navigation">
                  <DashboardButton
                    onClick={() => setFactIndex((idx) => (idx === 0 ? LOCAL_FACTS.length - 1 : idx - 1))}
                    variant="secondary"
                    className="fact-nav-btn"
                  >
                    <Icon name="arrowLeft" />
                  </DashboardButton>
                  <span className="fact-nav-indicator">{factIndex + 1} / {LOCAL_FACTS.length}</span>
                  <DashboardButton
                    onClick={() => setFactIndex((idx) => (idx === LOCAL_FACTS.length - 1 ? 0 : idx + 1))}
                    variant="secondary"
                    className="fact-nav-btn"
                  >
                    <Icon name="arrowRight" />
                  </DashboardButton>
                </div>
              </div>
              <div className="daily-completion-actions">
                <DashboardButton onClick={() => setShowFacts(false)} variant="secondary">
                  <Icon name="arrowLeft" /> Back to Result
                </DashboardButton>
              </div>
            </div>
          ) : (
            <div className="daily-completion-summary">
              <div className="daily-completion-fire" aria-label={t.fireLabel(challenge.score)}>
                <span className="daily-fire-halo" />
                <span className="daily-fire-flame">
                  <i className="daily-fire-outer" />
                  <i className="daily-fire-middle" />
                  <i className="daily-fire-core" />
                </span>
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
              </div>
              <div className="daily-completion-copy">
                <span className="daily-english-eyebrow">{t.eyebrow}</span>
                <h2>{t.completedHeading}</h2>
                <p>{t.completedMessage}</p>
                <strong className="daily-completion-score">{t.complete(challenge.score, challenge.total_questions)}</strong>
              </div>
              <div className="daily-completion-actions">
                <div className="daily-completion-streak">
                  <span>{t.currentStreak}</span>
                  <strong>{challenge.current_streak} {challenge.current_streak === 1 ? t.day : t.days}</strong>
                </div>
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
          )}
          <PracticeActivity activity={challenge.activity} />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-panel daily-english-panel">
      <div className="daily-english-header">
        <div>
          <span className="daily-english-eyebrow">{t.eyebrow}</span>
          <h2>{t.heading}</h2>
          <p>{t.subtitle(calendarLabel)}</p>
        </div>
        <div className="daily-streak-stats">
          <div>
            <span>{t.currentStreak}</span>
            <strong>{challenge.current_streak}</strong>
          </div>
          <div>
            <span>{t.longestStreak}</span>
            <strong>{challenge.longest_streak}</strong>
          </div>
        </div>
      </div>

      <div className="daily-english-layout">
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

        <PracticeActivity activity={challenge.activity} />
      </div>
    </section>
  );
}
