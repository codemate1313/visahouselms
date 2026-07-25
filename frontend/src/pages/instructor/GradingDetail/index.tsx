import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { GradingDetail as GradingDetailType } from "@/api/types";
import { Button } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { gradingDetailStrings as strings } from "./GradingDetail.strings";
import { PartGradingCard } from "./components/PartGradingCard";

export function GradingDetail() {
  const { id } = useParams();
  const user = useAuthStore((state) => state.user);
  const isInstituteInstructor = user?.role === "INST_INSTRUCTOR";
  const [detail, setDetail] = useState<GradingDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    apiClient
      .get<GradingDetailType>(`/instructor/grading/${id}`)
      .then(({ data }) => { setDetail(data); setError(null); })
      .catch(() => setError(strings.errors.load));
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function queueAction(action: "claim" | "release") {
    setBusy(true);
    try {
      await apiClient.post(`/instructor/grading/${id}/${action}`);
      load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.queueAction(action)));
    } finally {
      setBusy(false);
    }
  }

  async function resolve(resolution: "resolved" | "rejected") {
    setBusy(true);
    try {
      await apiClient.post(`/instructor/grading/${id}/reevaluation/resolve`, { resolution, note: resolutionNote });
      load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.resolve));
    } finally {
      setBusy(false);
    }
  }

  if (error && !detail) return <p className="error-text">{error}</p>;
  if (!detail) return <p>{strings.loading}</p>;
  const subjectiveParts = detail.parts.filter((part) => !part.auto_marked);
  const claimedByMe = detail.queue.assigned_to_id === user?.id;
  const claimedByOther = detail.queue.assigned_to_id != null && !claimedByMe;
  const hasOpenReevaluation = detail.reevaluation && ["pending", "in_review"].includes(detail.reevaluation.status);
  const canEdit = !claimedByOther && (detail.queue.status !== "completed" || Boolean(hasOpenReevaluation));

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="page-eyebrow">{detail.queue.routing_reason.replaceAll("_", " ")}</span>
          <h1>{detail.student_name}</h1>
          <p className="page-subtitle">{detail.module_title} · {detail.student_email}</p>
        </div>
        <div className="page-header-actions">
          {detail.queue.status === "pending" && (
            <Button disabled={busy} onClick={() => queueAction("claim")}>
              {strings.claim}
            </Button>
          )}
          {claimedByMe && detail.queue.status === "claimed" && (
            <Button variant="secondary" disabled={busy} onClick={() => queueAction("release")}>
              {strings.release}
            </Button>
          )}
          <Link className="button-link secondary-button" to={isInstituteInstructor ? "/institute-instructor/grading" : "/super-admin/instructor/grading"}>
            {strings.backToQueue}
          </Link>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <div className="cefr-grading-note">
        <strong>{strings.cefrNote.title}</strong>
        <p>{strings.cefrNote.body}</p>
      </div>
      {claimedByOther && (
        <div className="banner">
          <strong>{strings.readOnly.title}</strong> {strings.readOnly.claimedBy(detail.queue.assigned_to_name ?? "")}
        </div>
      )}
      {hasOpenReevaluation && (
        <section className="workspace-panel reevaluation-review">
          <div className="panel-heading">
            <div>
              <span className="badge badge-red">{strings.reevaluation.badge}</span>
              <h2>{strings.reevaluation.title}</h2>
            </div>
          </div>
          <p>{detail.reevaluation?.reason}</p>
          <label htmlFor="resolution-note">{strings.reevaluation.resolutionNoteLabel}</label>
          <textarea
            id="resolution-note"
            rows={3}
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            placeholder={strings.reevaluation.resolutionNotePlaceholder}
          />
          {canEdit && (
            <div className="form-actions">
              <Button disabled={busy || resolutionNote.trim().length < 10} onClick={() => resolve("resolved")}>
                {strings.reevaluation.resolve}
              </Button>
              <Button variant="secondary" disabled={busy || resolutionNote.trim().length < 10} onClick={() => resolve("rejected")}>
                {strings.reevaluation.reject}
              </Button>
            </div>
          )}
        </section>
      )}
      {detail.flags.length > 0 && (
        <section className="workspace-panel">
          <div className="panel-heading">
            <div>
              <h2>{strings.flags.title}</h2>
              <p>{strings.flags.description}</p>
            </div>
          </div>
          <ul className="activity-list">
            {detail.flags.map((flag, index) => (
              <li key={index}>
                <span>{flag.flag_type.replace("_", " ")}</span>
                <time>{new Date(flag.occurred_at).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
      {subjectiveParts.map((part) => (
        <PartGradingCard key={part.id} part={part} attemptId={id!} canEdit={canEdit} aiConfigured={detail.ai_assistance.configured} onGraded={setDetail} />
      ))}
    </div>
  );
}
