import { testRunnerStrings as strings } from "../TestRunner.strings";
import { Button } from "@/components/ui/Button/Button";

interface LcPartPagerProps {
  partIndex: number;
  partCount: number;
  onSelectPart: (index: number) => void;
  onRequestSubmit: () => void;
  isNavigationLocked?: boolean;
  submitting?: boolean;
  previousPartIndex?: number | null;
  nextPartIndex?: number | null;
}

/**
 * The Previous / Next pair that sits above the question area on the Final Test.
 *
 * On the official platform these live in the page body rather than the header,
 * and each button is only drawn when there is somewhere to go - the first part
 * shows Next alone, the last shows Previous alone. Listening never renders this
 * at all: the recording drives the pacing, so the runner omits the pager there.
 */
export function LcPartPager({
  partIndex,
  partCount,
  onSelectPart,
  onRequestSubmit,
  isNavigationLocked = false,
  submitting = false,
  previousPartIndex,
  nextPartIndex,
}: LcPartPagerProps) {
  const t = strings.header;
  const hasPrevious = previousPartIndex !== undefined
    ? previousPartIndex !== null
    : partIndex > 0;
  const previousTarget = previousPartIndex !== undefined ? previousPartIndex : partIndex - 1;

  const hasNext = nextPartIndex !== undefined
    ? nextPartIndex !== null
    : partIndex < partCount - 1;
  const nextTarget = nextPartIndex !== undefined ? nextPartIndex : partIndex + 1;

  if (partCount <= 0) return null;

  return (
    <div className="lc-pager" aria-label={t.partNavigationAriaLabel}>
      {hasPrevious && previousTarget !== null && (
        <Button
          type="button"
          variant="secondary"
          className="lc-pager-button"
          disabled={isNavigationLocked}
          onClick={() => onSelectPart(previousTarget)}
          title={isNavigationLocked ? t.navigationLocked : undefined}
        >
          {t.previous}
        </Button>
      )}
      <Button
        type="button"
        className="lc-pager-button"
        disabled={isNavigationLocked || submitting}
        onClick={() => {
          if (hasNext && nextTarget !== null) {
            onSelectPart(nextTarget);
          } else {
            onRequestSubmit();
          }
        }}
        title={isNavigationLocked ? t.navigationLocked : undefined}
      >
        {submitting ? strings.footer.submitting : hasNext ? t.next : strings.footer.submitTest}
      </Button>
    </div>
  );
}
