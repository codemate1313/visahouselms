import { testRunnerStrings as strings } from "../TestRunner.strings";

interface LcPartPagerProps {
  partIndex: number;
  partCount: number;
  onSelectPart: (index: number) => void;
  isNavigationLocked?: boolean;
}

/**
 * The Previous / Next pair that sits above the question area on the Final Test.
 *
 * On the official platform these live in the page body rather than the header,
 * and each button is only drawn when there is somewhere to go - the first part
 * shows Next alone, the last shows Previous alone. Listening never renders this
 * at all: the recording drives the pacing, so the runner omits the pager there.
 */
export function LcPartPager({ partIndex, partCount, onSelectPart, isNavigationLocked = false }: LcPartPagerProps) {
  const t = strings.header;
  const hasPrevious = partIndex > 0;
  const hasNext = partIndex < partCount - 1;
  if (!hasPrevious && !hasNext) return null;

  return (
    <div className="lc-pager" aria-label={t.partNavigationAriaLabel}>
      {hasPrevious && (
        <button
          type="button"
          className="lc-pager-button"
          disabled={isNavigationLocked}
          onClick={() => onSelectPart(partIndex - 1)}
          title={isNavigationLocked ? t.navigationLocked : undefined}
        >
          {t.previous}
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          className="lc-pager-button"
          disabled={isNavigationLocked}
          onClick={() => onSelectPart(partIndex + 1)}
          title={isNavigationLocked ? t.navigationLocked : undefined}
        >
          {t.next}
        </button>
      )}
    </div>
  );
}
