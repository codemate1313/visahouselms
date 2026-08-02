import type { Attempt } from "@/api/types";
import { attemptResultDetailsStrings as strings } from "../AttemptResultDetails.strings";

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
        <span
          className={`badge ${
            retakeRequest.status === "approved"
              ? "badge-green"
              : retakeRequest.status === "rejected"
                ? "badge-red"
                : "badge-amber"
          }`}
        >
          {retakeRequest.status}
        </span>
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
