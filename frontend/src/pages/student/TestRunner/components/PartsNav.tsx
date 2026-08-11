import type { Attempt } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";

interface SectionGroup {
  section: string;
  label: string;
  parts: Array<{ part: Attempt["parts"][number]; index: number }>;
}

interface PartsNavProps {
  answeredCount: number;
  totalQuestions: number;
  sectionGroups: SectionGroup[];
  partIndex: number;
  onSelectPart: (index: number) => void;
  isListeningLocked?: boolean;
}

export function PartsNav({ answeredCount, totalQuestions, sectionGroups, partIndex, onSelectPart, isListeningLocked = false }: PartsNavProps) {
  const t = strings.nav;
  return (
    <nav className="test-runner-parts" aria-label={t.testSectionsAriaLabel}>
      <div className="test-runner-progress-summary">
        <span>{t.progress}</span>
        <strong>
          {answeredCount}/{totalQuestions}
        </strong>
      </div>
      {sectionGroups.map((group) => (
        <section className="test-runner-section-group" key={group.section}>
          <h2>{group.label}</h2>
          {group.parts.map(({ part, index }) => {
            const complete = part.question_count > 0 && part.answered_count === part.question_count;
            return (
              <button
                type="button"
                key={part.id}
                disabled={isListeningLocked && index !== partIndex}
                className={`test-runner-part-tab${index === partIndex ? " is-active" : ""}${complete ? " is-complete" : ""}${isListeningLocked && index !== partIndex ? " is-disabled" : ""}`}
                onClick={() => !isListeningLocked && onSelectPart(index)}
                aria-current={index === partIndex ? "step" : undefined}
                title={isListeningLocked && index !== partIndex ? "Navigation locked during listening section audio" : undefined}
              >
                <span>{part.title}</span>
                <span className="test-runner-part-progress">
                  {part.answered_count}/{part.question_count}
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </nav>
  );
}
