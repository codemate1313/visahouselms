import type { Attempt } from "@/api/types";
import { Icon } from "@/components/icons";
import { testRunnerStrings as strings } from "../TestRunner.strings";
import { LcFlagIcon } from "./PeopleCertBrand";

interface SectionGroup {
  section: string;
  label: string;
  parts: Array<{ part: Attempt["parts"][number]; index: number }>;
}

interface PartsNavProps {
  answeredCount?: number;
  totalQuestions?: number;
  sectionGroups: SectionGroup[];
  partIndex: number;
  onSelectPart: (index: number) => void;
  /** Set while the candidate must stay on the current part: listening audio is
      playing, or the speaking interview is running. */
  isNavigationLocked?: boolean;
  /** Final Test only: the PeopleCert section rail replaces the standard nav. */
  languageCertSkin?: boolean;
}

export function formatPartTitle(title: string) {
  if (!title) return "";
  const match = title.match(/^([A-Za-z]+)\s*(?:-|Part)?\s*(\d+[A-Za-z]?)$/i);
  if (match) {
    const sectionName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    return `${sectionName} Part ${match[2].toUpperCase()}`;
  }
  return title;
}

export function PartsNav({
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
            <h2 className="lc-rail-heading">{group.label}</h2>
            <div className="lc-rail-tabs">
              {group.parts.map(({ part, index }) => {
                const complete = part.question_count > 0 && part.answered_count === part.question_count;
                /* Completion has to survive being colourblind or a quick
                   glance, so the fill is never the only signal - a checkmark
                   rides alongside it, and its own screen-reader-only text
                   says the word the icon can't. */
                const isComplete = complete && index !== partIndex;
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
                      className={`lc-rail-tab${index === partIndex ? " is-active" : ""}${isComplete ? " is-complete" : ""}`}
                      onClick={() => !isNavigationLocked && onSelectPart(index)}
                      aria-current={index === partIndex ? "step" : undefined}
                      title={locked ? t.navigationLocked : undefined}
                    >
                      <span className="lc-rail-tab-content">
                        {isComplete && <Icon name="check" className="lc-rail-tab-check" />}
                        <span>{formatPartTitle(part.title)}</span>
                      </span>
                      {isComplete && <span className="sr-only"> (Complete)</span>}
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
      {sectionGroups.map((group) => (
        <section className="test-runner-section-group" key={group.section}>
          <h2>{group.label}</h2>
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
              </button>
            );
          })}
        </section>
      ))}
    </nav>
  );
}
