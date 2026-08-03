import type { Attempt } from "@/api/types";
import { Badge } from "@/components/ui";

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
        <Badge tone={reevaluation.status === "resolved" ? "green" : reevaluation.status === "rejected" ? "red" : "amber"}>
          {reevaluation.status.replace("_", " ")}
        </Badge>
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
