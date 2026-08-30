import type { FormEvent } from "react";
import { RequiredMark } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { attemptResultDetailsStrings as strings } from "../AttemptResultDetails.strings";

interface ReevaluationFormProps {
  reason: string;
  onReasonChange: (value: string) => void;
  requesting: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function ReevaluationForm({ reason, onReasonChange, requesting, onSubmit }: ReevaluationFormProps) {
  const t = strings.reevaluationForm;
  return (
    <form className="workspace-panel reevaluation-form" onSubmit={onSubmit}>
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2>{t.heading}</h2>
          <p>{t.description}</p>
        </div>
      </div>
      <label htmlFor="reevaluation-reason">{t.reasonLabel}<RequiredMark /></label>
      <textarea
        id="reevaluation-reason"
        rows={4}
        minLength={1}
        maxLength={2000}
        required
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
      />
      <div className="form-actions">
        <Button type="submit" disabled={requesting || reason.trim().length === 0}>{requesting ? t.submitting : t.submit}</Button>
      </div>
    </form>
  );
}
