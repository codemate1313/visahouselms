import { testRunnerStrings as strings } from "../TestRunner.strings";
import { Button } from "@/components/ui/Button/Button";

interface ViolationPolicyModalProps {
  count: number;
  limit: number;
  autoSubmitted: boolean;
  onContinue: () => void;
  onViewResult: () => void;
}

export function ViolationPolicyModal({
  count,
  limit,
  autoSubmitted,
  onContinue,
  onViewResult,
}: ViolationPolicyModalProps) {
  const t = strings.security;
  return (
    <div className="test-violation-modal-backdrop" role="dialog" aria-modal="true">
      <section className="test-violation-modal" aria-labelledby="test-violation-title">
        <div className="test-violation-icon" aria-hidden="true">!</div>
        <h2 id="test-violation-title">
          {autoSubmitted ? t.violationFinalTitle : t.violationWarningTitle(count, limit)}
        </h2>
        <p>{autoSubmitted ? t.violationFinalBody : t.violationWarningBody}</p>
        <Button type="button" onClick={autoSubmitted ? onViewResult : onContinue}>
          {autoSubmitted ? t.viewResult : t.continueTest}
        </Button>
      </section>
    </div>
  );
}
