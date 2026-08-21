import type { Attempt } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { LcFlagIcon } from "./PeopleCertBrand";

interface SectionGroup {
  section: string;
  label: string;
  durationMinutes?: number;
  parts: Array<{ part: Attempt["parts"][number]; index: number }>;
}

interface PartsNavProps {
  answeredCount: number;
  totalQuestions: number;
  sectionGroups: SectionGroup[];
  partIndex: number;
  onSelectPart: (index: number) => void;
  /** Set while the candidate must stay on the current part: listening audio is
      playing, or the speaking interview is running. */
  isNavigationLocked?: boolean;
  /** Final Test only: the PeopleCert section rail replaces the standard nav. */
  languageCertSkin?: boolean;
}

function formatPartTitle(title: string) {
  const match = title.match(/^([A-Za-z\s]+)\s+(\d+)$/);
  if (match) {
    const sectionName = match[1].trim();
    return `${sectionName} Part ${match[2]}`;
  }
  return title;
}

export function PartsNav({
  answeredCount,
  totalQuestions,
  sectionGroups,
  partIndex,
  onSelectPart,
  isNavigationLocked = false,
  languageCertSkin = false,
}: PartsNavProps) {
  const t = strings.nav;

  /* The exam rail carries no counters: the official platform shows the part
     names only, and a per-part "3/7" beside them is the giveaway that this is
     a practice engine. Completion is still signalled, by the tab filling in. */
  if (languageCertSkin) {
    return (
      <nav className="test-runner-parts lc-rail" aria-label={t.testSectionsAriaLabel}>
        {sectionGroups.map((group) => (
          <section className="lc-rail-group" data-section={group.section} key={group.section}>
            <h2 className="lc-rail-heading">
              {group.label}
              {group.durationMinutes ? <span> · {group.durationMinutes} min</span> : null}
            </h2>
            <div className="lc-rail-tabs">
              {group.parts.map(({ part, index }) => {
                const complete = part.question_count > 0 && part.answered_count === part.question_count;
                const locked = isNavigationLocked && index !== partIndex;
                return (
                  /* The flag is a sibling of the tab rather than something
                     drawn on it, so it keeps its own column and the tabs stay
                     aligned whatever their label length. */
                  <div className="lc-rail-row" key={part.id}>
                    <LcFlagIcon />
                    <button
                      type="button"
                      disabled={locked}
                      className={`lc-rail-tab${index === partIndex ? " is-active" : ""}${complete && index !== partIndex ? " is-complete" : ""}`}
                      onClick={() => !isNavigationLocked && onSelectPart(index)}
                      aria-current={index === partIndex ? "step" : undefined}
                      title={locked ? t.navigationLocked : undefined}
                    >
                      {part.title}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    );
  }

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
          <h2>
            {group.label}
            {group.durationMinutes ? <span> · {group.durationMinutes} min</span> : null}
          </h2>
          {group.parts.map(({ part, index }) => {
            const complete = part.question_count > 0 && part.answered_count === part.question_count;
            return (
              <button
                type="button"
                key={part.id}
                disabled={isNavigationLocked && index !== partIndex}
                className={`test-runner-part-tab${index === partIndex ? " is-active" : ""}${complete ? " is-complete" : ""}${isNavigationLocked && index !== partIndex ? " is-disabled" : ""}`}
                onClick={() => !isNavigationLocked && onSelectPart(index)}
                aria-current={index === partIndex ? "step" : undefined}
                title={isNavigationLocked && index !== partIndex ? strings.nav.navigationLocked : undefined}
              >
                <span>{formatPartTitle(part.title)}</span>
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
