import type { FormEvent } from "react";
import { RequiredMark } from "@/components/ui";
import { attemptResultDetailsStrings as strings } from "../AttemptResultDetails.strings";

interface RetakeRequestFormProps {
  reason: string;
  onReasonChange: (value: string) => void;
  requesting: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function RetakeRequestForm({ reason, onReasonChange, requesting, onSubmit }: RetakeRequestFormProps) {
  const t = strings.retakeForm;
  return (
    <form className="workspace-panel reevaluation-form" onSubmit={onSubmit}>
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2>{t.heading}</h2>
          <p>{t.description}</p>
        </div>
      </div>
      <label htmlFor="retake-reason">{t.reasonLabel}<RequiredMark /></label>
      <textarea
        id="retake-reason"
        rows={4}
        minLength={1}
        maxLength={2000}
        required
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
      />
      <div className="form-actions">
        <button disabled={requesting || reason.trim().length === 0}>{requesting ? t.submitting : t.submit}</button>
      </div>
    </form>
  );
}
