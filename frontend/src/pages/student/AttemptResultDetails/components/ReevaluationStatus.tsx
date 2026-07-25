import type { Attempt } from "@/api/types";
import { attemptResultDetailsStrings as strings } from "../AttemptResultDetails.strings";

interface ReevaluationStatusProps {
  reevaluation: NonNullable<Attempt["reevaluation"]>;
}

export function ReevaluationStatus({ reevaluation }: ReevaluationStatusProps) {
  const t = strings.reevaluation;
  return (
    <section className="workspace-panel reevaluation-status">
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">{t.resultReviewEyebrow}</span>
          <h2>{t.requestHeading}</h2>
        </div>
        <span className={`badge ${reevaluation.status === "resolved" ? "badge-green" : reevaluation.status === "rejected" ? "badge-red" : "badge-amber"}`}>
          {reevaluation.status.replace("_", " ")}
        </span>
      </div>
      <p>{reevaluation.reason}</p>
      {reevaluation.assigned_to_name && (
        <p className="hint">
          {t.reviewerPrefix} {reevaluation.assigned_to_name}
        </p>
      )}
      {reevaluation.resolution_note && (
        <div className="banner">
          <strong>{t.resolutionHeading}</strong> {reevaluation.resolution_note}
        </div>
      )}
    </section>
  );
}
