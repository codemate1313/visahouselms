import type { Attempt } from "@/api/types";

export interface ReevaluationStatusStrings {
  eyebrow: string;
  heading: string;
  reviewerPrefix: string;
  resolutionHeading: string;
}

interface ReevaluationStatusProps {
  reevaluation: NonNullable<Attempt["reevaluation"]>;
  strings: ReevaluationStatusStrings;
}

export function ReevaluationStatus({ reevaluation, strings: t }: ReevaluationStatusProps) {
  return (
    <section className="workspace-panel reevaluation-status">
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2>{t.heading}</h2>
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
