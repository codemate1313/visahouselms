import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { GradingDetail as GradingDetailType, GradingQueueItem, GradingQueueMetadata } from "@/api/types";
import { Badge, Button, LinkButton, PageHeader } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { gradingDetailStrings as strings } from "./GradingDetail.strings";
import { PartGradingCard } from "./components/PartGradingCard";

export function GradingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
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
      .catch((err: unknown) => {
        setDetail(null);
        setError(extractErrorMessage(err, strings.errors.load));
      });
  }
  useEffect(() => {
    setDetail(null);
    setError(null);
    apiClient
      .post<GradingDetailType>(`/instructor/grading/${id}/start`)
      .then(({ data }) => setDetail(data))
      .catch((err: unknown) => setError(extractErrorMessage(err, strings.errors.load)));
  }, [id]);

  const shouldHeartbeat =
    detail?.queue.status === "claimed" && detail.queue.assigned_to_id === user?.id;

  useEffect(() => {
    if (!shouldHeartbeat) return;
    const heartbeatId = window.setInterval(() => {
      apiClient
        .post<GradingQueueMetadata>(`/instructor/grading/${id}/claim`)
        .then(({ data: queue }) => setDetail((current) => current ? { ...current, queue } : current))
        .catch((err: unknown) => setError(extractErrorMessage(err, strings.errors.queueAction("claim"))));
    }, 30_000);
    return () => window.clearInterval(heartbeatId);
  }, [id, shouldHeartbeat]);

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

  async function submitFullTest() {
    setBusy(true);
    try {
      const { data } = await apiClient.post<GradingDetailType>(`/instructor/grading/${id}/submit`);
      setDetail(data);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.submitFullTest.errorMessage));
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

  async function handleNextReview() {
    setBusy(true);
    try {
      const { data } = await apiClient.get<GradingQueueItem[]>("/instructor/grading");
      const nextItem = data.find(
        (item) =>
          String(item.id) !== String(id) &&
          (item.queue.status === "pending" || item.queue.assigned_to_id === user?.id),
      );
      if (nextItem) {
        navigate(isInstituteInstructor ? `/institute-instructor/grading/${nextItem.id}` : `/super-admin/instructor/grading/${nextItem.id}`);
      } else {
        navigate(isInstituteInstructor ? "/institute-instructor/grading" : "/super-admin/instructor/grading");
      }
    } catch {
      navigate(isInstituteInstructor ? "/institute-instructor/grading" : "/super-admin/instructor/grading");
    } finally {
      setBusy(false);
    }
  }

  const [openPartIds, setOpenPartIds] = useState<Record<number, boolean>>({});

  const isPartOpen = (partId: number, hasSavedProgress: boolean) => {
    if (openPartIds[partId] !== undefined) return openPartIds[partId];
    return !hasSavedProgress;
  };

  const handleToggleOpen = (partId: number, open: boolean) => {
    setOpenPartIds((prev) => ({ ...prev, [partId]: open }));
  };

  const handleGradedNext = (currentPartId: number) => {
    const currentIndex = subjectiveParts.findIndex((p) => p.id === currentPartId);
    const nextPart = subjectiveParts.slice(currentIndex + 1).find((p) => !p.grade) || subjectiveParts[currentIndex + 1];

    setOpenPartIds((prev) => {
      const updated = { ...prev, [currentPartId]: false };
      if (nextPart) {
        updated[nextPart.id] = true;
      }
      return updated;
    });

    if (nextPart) {
      setTimeout(() => {
        const el = document.getElementById(`part-card-${nextPart.id}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 120);
    }
  };

  if (error && !detail) return <p className="error-text">{error}</p>;
  if (!detail) return <p>{strings.loading}</p>;
  const subjectiveParts = detail.parts.filter((part) => !part.auto_marked);
  const allSubjectivePartsGraded = subjectiveParts.length > 0 && subjectiveParts.every((part) => part.grade?.status === "graded");
  const readyPartsCount = subjectiveParts.filter(
    (part) => part.grade && part.rubric.every((criterion) => part.grade!.criteria.some((item) => item.criterion === criterion.criterion)),
  ).length;
  const allPartsReady = subjectiveParts.length > 0 && readyPartsCount === subjectiveParts.length;
  const claimedByMe = detail.queue.assigned_to_id === user?.id;
  const claimedByOther = detail.queue.assigned_to_id != null && !claimedByMe;
  const hasOpenReevaluation = detail.reevaluation && ["pending", "in_review"].includes(detail.reevaluation.status);
  const canEdit = !claimedByOther && (detail.queue.status !== "completed" || Boolean(hasOpenReevaluation));

  return (
    <div>
      <PageHeader
        eyebrow={detail.queue.routing_reason.replaceAll("_", " ")}
        title={detail.student_name}
        subtitle={`${detail.module_title} · ${detail.student_email}`}
        actions={
          <>
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
          <LinkButton variant="secondary" to={isInstituteInstructor ? "/institute-instructor/grading" : "/super-admin/instructor/grading"}>
            {strings.backToQueue}
          </LinkButton>
          </>
        }
      />
      {error && <p className="error-text">{error}</p>}
      <div className="cefr-grading-note">
        <strong>{strings.cefrNote.title}</strong>
        <p>{strings.cefrNote.body}</p>
      </div>
      {allSubjectivePartsGraded && (
        <section className="evaluation-completed-card">
          <div className="completed-icon-circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2>{strings.completion.title}</h2>
          <p>{strings.completion.subtitle}</p>
          <div className="completed-actions">
            <Button disabled={busy} onClick={handleNextReview}>
              {strings.completion.nextReview}
            </Button>
            <LinkButton variant="secondary" to={isInstituteInstructor ? "/institute-instructor/grading" : "/super-admin/instructor/grading"}>
              {strings.completion.backToQueue}
            </LinkButton>
          </div>
        </section>
      )}
      {detail.status === "grading" && subjectiveParts.length > 0 && (
        <section className="workspace-panel submit-full-test-panel">
          <div className="panel-heading">
            <div>
              <h2>{strings.submitFullTest.title}</h2>
              <p>{strings.submitFullTest.description}</p>
            </div>
            <Badge tone="amber">{strings.submitFullTest.readyCount(readyPartsCount, subjectiveParts.length)}</Badge>
          </div>
          {canEdit && (
            <div className="form-actions">
              <Button disabled={busy || !allPartsReady} onClick={submitFullTest}>
                {busy ? strings.submitFullTest.submitting : strings.submitFullTest.action}
              </Button>
            </div>
          )}
        </section>
      )}
      {claimedByOther && (
        <div className="banner">
          <strong>{strings.readOnly.title}</strong> {strings.readOnly.claimedBy(detail.queue.assigned_to_name ?? "")}
        </div>
      )}
      {hasOpenReevaluation && (
        <section className="workspace-panel reevaluation-review">
          <div className="panel-heading">
            <div>
              <Badge tone="red">{strings.reevaluation.badge}</Badge>
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
        <PartGradingCard
          key={part.id}
          part={part}
          attemptId={id!}
          canEdit={canEdit}
          aiConfigured={detail.ai_assistance.configured}
          onGraded={setDetail}
          isOpen={isPartOpen(part.id, part.grade != null)}
          onToggleOpen={(open) => handleToggleOpen(part.id, open)}
          onGradedNext={handleGradedNext}
        />
      ))}
    </div>
  );
}
