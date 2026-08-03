import type { Attempt } from "@/api/types";
import { attemptResultStrings as strings } from "../AttemptResult.strings";
import { Badge } from "@/components/ui";

interface RetakeRequestStatusProps {
  retakeRequest: NonNullable<Attempt["retake_request"]>;
}

export function RetakeRequestStatus({ retakeRequest }: RetakeRequestStatusProps) {
  const t = strings.retake;
  return (
    <section className="workspace-panel reevaluation-status">
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2>{t.heading}</h2>
        </div>
        <Badge tone={retakeRequest.status === "approved"
              ? "green"
              : retakeRequest.status === "rejected"
                ? "red"
                : "amber"}
        >
          {retakeRequest.status}
        </Badge>
      </div>
      <p>{retakeRequest.reason}</p>
      {retakeRequest.reviewed_by_name && (
        <p className="hint">
          {t.reviewerPrefix} {retakeRequest.reviewed_by_name}
        </p>
      )}
      {retakeRequest.review_note && (
        <div className="banner">
          <strong>{t.resolutionHeading}</strong> {retakeRequest.review_note}
        </div>
      )}
    </section>
  );
}
