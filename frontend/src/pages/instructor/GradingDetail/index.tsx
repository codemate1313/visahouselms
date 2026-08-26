import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { AttemptPart, GradingDetail as GradingDetailType, GradingQueueItem, GradingQueueMetadata } from "@/api/types";
import { Badge, Button, LinkButton, Modal, PageHeader } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { formatDateTime } from "@/utils/date";
import { gradingDetailStrings as strings } from "./GradingDetail.strings";
import { PartGradingCard } from "./components/PartGradingCard";
import { FloatingRubricPanel } from "./components/FloatingRubricPanel";

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

  // ---- Scoring state, lifted so one FloatingRubricPanel can drive every part.
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [partMarks, setPartMarks] = useState<Record<number, Record<string, string>>>({});
  const [partComments, setPartComments] = useState<Record<number, string>>({});
  // One part visible at a time; the panel's Prev/Next drive the index.
  const [activeIndex, setActiveIndex] = useState(0);
  // Schema section closed by default; the instructor opens it to score.
  const [rubricOpen, setRubricOpen] = useState(false);
  const [savingPartId, setSavingPartId] = useState<number | null>(null);
  const [autosavePartId, setAutosavePartId] = useState<number | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [missingPartsOpen, setMissingPartsOpen] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);

  // Seed the local scoring state from whatever the server already has whenever
  // the attempt loads or reloads.
  useEffect(() => {
    if (!detail) return;
    setPartMarks((current) => {
      const next = { ...current };
      for (const part of detail.parts) {
        if (part.auto_marked) continue;
        next[part.id] = Object.fromEntries(
          part.rubric.map((criterion) => [
            criterion.criterion,
            current[part.id]?.[criterion.criterion]
              ?? part.grade?.criteria.find((item) => item.criterion === criterion.criterion)?.marks_awarded
              ?? "",
          ]),
        );
      }
      return next;
    });
    setPartComments((current) => {
      const next = { ...current };
      for (const part of detail.parts) {
        if (part.auto_marked) continue;
        if (current[part.id] === undefined) next[part.id] = part.grade?.comment ?? "";
      }
      return next;
    });
  }, [detail]);

  const setMarksForPart = useCallback((partId: number, criterion: string, value: string) => {
    setPartMarks((current) => ({
      ...current,
      [partId]: { ...(current[partId] ?? {}), [criterion]: value },
    }));
  }, []);

  const applySuggestion = useCallback((partId: number, marks: Record<string, string>, comment: string) => {
    setPartMarks((current) => ({ ...current, [partId]: { ...(current[partId] ?? {}), ...marks } }));
    setPartComments((current) => ({ ...current, [partId]: comment }));
  }, []);

  const isScoreFilled = useCallback((value: string | undefined) => {
    return value !== undefined && value !== "" && Number.isFinite(Number(value));
  }, []);

  const partHasCompleteScores = useCallback((part: AttemptPart) => {
    const marks = partMarks[part.id] ?? {};
    return part.rubric.every((criterion) => isScoreFilled(marks[criterion.criterion]));
  }, [isScoreFilled, partMarks]);

  const partHasProgress = useCallback((part: AttemptPart) => {
    const marks = partMarks[part.id] ?? {};
    return (
      Object.values(marks).some((value) => isScoreFilled(value)) ||
      (partComments[part.id] ?? "").trim() !== ""
    );
  }, [isScoreFilled, partComments, partMarks]);

  const buildPartPayload = useCallback((part: AttemptPart, includeAllCriteria = false) => {
    const isPublished = part.grade?.status === "graded" || part.grade?.status === "ai_graded";
    const marks = partMarks[part.id] ?? {};
    const comment = partComments[part.id] ?? "";
    const criteria = part.rubric
      .filter((criterion) => includeAllCriteria || isPublished || isScoreFilled(marks[criterion.criterion]))
      .map((criterion) => {
        // Defensive clamp: the input already clamps on change, but this keeps
        // any other path into partMarks from ever producing an out-of-range
        // payload for autosave or manual save.
        const raw = Number(marks[criterion.criterion]);
        const marksAwarded = Number.isFinite(raw) ? Math.min(Math.max(raw, 0), criterion.max_marks) : raw;
        return { criterion: criterion.criterion, marks_awarded: marksAwarded };
      });
    return { criteria, comment: comment.trim() ? comment : undefined };
  }, [isScoreFilled, partComments, partMarks]);

  function payloadKey(payload: ReturnType<typeof buildPartPayload>) {
    return JSON.stringify({ criteria: payload.criteria, comment: payload.comment ?? "" });
  }

  function serverPartKey(part: AttemptPart) {
    const criteria = part.rubric
      .map((criterion) => {
        const saved = part.grade?.criteria.find((item) => item.criterion === criterion.criterion);
        return saved ? { criterion: criterion.criterion, marks_awarded: Number(saved.marks_awarded) } : null;
      })
      .filter((item): item is { criterion: string; marks_awarded: number } => item !== null);
    return JSON.stringify({ criteria, comment: part.grade?.comment ?? "" });
  }

  async function savePart(part: AttemptPart, options: { silent?: boolean; requireComplete?: boolean } = {}) {
    if (options.requireComplete && !partHasCompleteScores(part)) {
      showError(strings.part.completeBeforeNextMessage, strings.part.completeBeforeNextTitle);
      return false;
    }
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setSavingPartId(part.id);
    try {
      const { data } = await apiClient.post<GradingDetailType>(
        `/instructor/grading/${id}/parts/${part.id}`,
        buildPartPayload(part, options.requireComplete),
      );
      setDetail(data);
      setAutosaveStatus("saved");
      if (!options.silent) {
        showSuccess(strings.part.gradedMessage(part.title), strings.part.savedTitle);
      }
      return true;
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.part.saveErrorMessage), strings.part.saveErrorTitle);
      setAutosaveStatus("error");
      return false;
    } finally {
      setSavingPartId(null);
    }
  }

  const subjectiveParts = detail?.parts.filter((part) => !part.auto_marked) ?? [];
  const boundedActiveIndex = subjectiveParts.length ? Math.min(Math.max(0, activeIndex), subjectiveParts.length - 1) : 0;
  const activeSubjectivePart = subjectiveParts[boundedActiveIndex] ?? null;
  const activeAllScored = activeSubjectivePart ? partHasCompleteScores(activeSubjectivePart) : false;
  // Named so the disabled Next/Finish button can tell the instructor exactly
  // which criterion is still blocking it, instead of only a toast that can
  // never fire because the button is disabled.
  const activeMarks = activeSubjectivePart ? (partMarks[activeSubjectivePart.id] ?? {}) : {};
  const firstUnscoredCriterion = activeSubjectivePart
    ? activeSubjectivePart.rubric.find((criterion) => !isScoreFilled(activeMarks[criterion.criterion]))?.criterion ?? null
    : null;
  const claimedByMe = detail?.queue.assigned_to_id === user?.id;
  const claimedByOther = detail?.queue.assigned_to_id != null && !claimedByMe;
  const hasOpenReevaluation = detail?.reevaluation && ["pending", "in_review"].includes(detail.reevaluation.status);
  const canEdit = Boolean(detail) && !claimedByOther && (detail!.queue.status !== "completed" || Boolean(hasOpenReevaluation));

  useEffect(() => {
    if (!activeSubjectivePart || !canEdit || !id || savingPartId === activeSubjectivePart.id) return;
    if (!partHasProgress(activeSubjectivePart)) {
      setAutosaveStatus("idle");
      return;
    }

    const payload = buildPartPayload(activeSubjectivePart);
    if (!payload.criteria.length && !payload.comment) return;
    if (payloadKey(payload) === serverPartKey(activeSubjectivePart)) {
      setAutosaveStatus("saved");
      return;
    }

    setAutosaveStatus("idle");
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      setAutosavePartId(activeSubjectivePart.id);
      setAutosaveStatus("saving");
      apiClient
        .post<GradingDetailType>(`/instructor/grading/${id}/parts/${activeSubjectivePart.id}`, payload)
        .then(({ data }) => {
          setDetail(data);
          setAutosaveStatus("saved");
        })
        .catch(() => setAutosaveStatus("error"))
        .finally(() => setAutosavePartId(null));
    }, 900);

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [activeSubjectivePart, activeIndex, buildPartPayload, canEdit, id, partComments, partHasProgress, partMarks, savingPartId]);

  if (error && !detail) return <p className="error-text">{error}</p>;
  if (!detail) return <p>{strings.loading}</p>;
  const allSubjectivePartsGraded = subjectiveParts.length > 0 && subjectiveParts.every((part) => part.grade?.status === "graded");
  const readyPartsCount = subjectiveParts.filter(
    (part) => part.grade && part.rubric.every((criterion) => part.grade!.criteria.some((item) => item.criterion === criterion.criterion)),
  ).length;
  const incompleteSubjectiveParts = subjectiveParts.filter(
    (part) => !part.grade || !part.rubric.every((criterion) => part.grade!.criteria.some((item) => item.criterion === criterion.criterion)),
  );
  const allPartsReady = subjectiveParts.length > 0 && readyPartsCount === subjectiveParts.length;

  function goToPart(partId: number) {
    const index = subjectiveParts.findIndex((part) => part.id === partId);
    if (index < 0) return;
    setActiveIndex(index);
    setRubricOpen(true);
    setMissingPartsOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById(`part-card-${partId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

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
                <time>{formatDateTime(flag.occurred_at)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(() => {
        const total = subjectiveParts.length;
        if (!total) return null;
        const boundedIndex = boundedActiveIndex;
        const active = activeSubjectivePart!;
        const marks = partMarks[active.id] ?? {};
        const isLastPart = boundedIndex >= total - 1;
        const nextLabel = isLastPart ? strings.part.rubricNav.finish : strings.part.rubricNav.next;
        const autosaveText = autosaveStatus === "saving" || autosavePartId === active.id
          ? strings.part.autosave.saving
          : autosaveStatus === "saved"
            ? strings.part.autosave.saved
            : autosaveStatus === "error"
              ? strings.part.autosave.error
              : strings.part.autosave.idle;
        const handleNext = async () => {
          if (!canEdit) {
            if (!isLastPart) setActiveIndex(Math.min(total - 1, boundedIndex + 1));
            return;
          }
          const saved = await savePart(active, { silent: true, requireComplete: true });
          if (!saved) return;
          if (!isLastPart) setActiveIndex(Math.min(total - 1, boundedIndex + 1));
        };
        return (
          <div className="grading-workspace">
            {/* Only the active part renders on the left; the rubric panel is
                docked as the right column. */}
            <div className="grading-parts-column is-single">
              <PartGradingCard
                key={active.id}
                part={active}
                attemptId={id!}
                canEdit={canEdit}
                aiConfigured={detail.ai_assistance.configured}
                comment={partComments[active.id] ?? ""}
                onCommentChange={(value) => setPartComments((current) => ({ ...current, [active.id]: value }))}
                onApplySuggestion={(m, c) => applySuggestion(active.id, m, c)}
                onActive={() => {}}
              />
            </div>
            <FloatingRubricPanel
              part={active}
              marks={marks}
              onMarksChange={(criterion, value) => setMarksForPart(active.id, criterion, value)}
              canEdit={canEdit}
              isOpen={rubricOpen}
              onToggleOpen={setRubricOpen}
              saving={savingPartId === active.id || autosavePartId === active.id}
              autosaveStatus={autosaveText}
              positionLabel={`${boundedIndex + 1} / ${total}`}
              canPrev={boundedIndex > 0}
              canNext={!isLastPart || canEdit}
              nextDisabled={canEdit && !activeAllScored}
              nextDisabledReason={canEdit && !activeAllScored && firstUnscoredCriterion ? strings.part.nextDisabledHint(firstUnscoredCriterion) : null}
              nextLabel={nextLabel}
              onPrev={() => setActiveIndex(Math.max(0, boundedIndex - 1))}
              onNext={handleNext}
            />
          </div>
        );
      })()}
      {/* Submit lives at the bottom: publishing is the last thing an instructor
          does, after every part above has a complete draft. */}
      {detail.status === "grading" && subjectiveParts.length > 0 && (
        <section className="workspace-panel submit-full-test-panel">
          <div className="panel-heading">
            <div>
              <h2>{strings.submitFullTest.title}</h2>
              <p>{strings.submitFullTest.description}</p>
            </div>
            <button
              type="button"
              className="parts-scored-chip"
              onClick={() => setMissingPartsOpen(true)}
              aria-label={strings.submitFullTest.openMissingDialog}
            >
              <span aria-hidden="true" />
              {strings.submitFullTest.readyCount(readyPartsCount, subjectiveParts.length)}
            </button>
          </div>
          {canEdit && (
            <div className="form-actions">
              <Button disabled={busy || !allPartsReady} onClick={submitFullTest}>
                {busy ? strings.submitFullTest.submitting : strings.submitFullTest.action}
              </Button>
            </div>
          )}
          <Modal
            open={missingPartsOpen}
            onClose={() => setMissingPartsOpen(false)}
            title={strings.submitFullTest.missingDialogTitle}
            size="md"
          >
            <div className="missing-graded-parts-dialog">
              <p>{strings.submitFullTest.missingDialogBody}</p>
              {incompleteSubjectiveParts.length > 0 ? (
                <div className="missing-graded-parts-list">
                  {incompleteSubjectiveParts.map((part) => {
                    const completed = part.grade
                      ? part.rubric.filter((criterion) => part.grade!.criteria.some((item) => item.criterion === criterion.criterion)).length
                      : 0;
                    return (
                      <button type="button" key={part.id} onClick={() => goToPart(part.id)}>
                        <div>
                          <strong>{part.title}</strong>
                          <span>{part.skill_focus}</span>
                        </div>
                        <small>{strings.submitFullTest.criteriaProgress(completed, part.rubric.length)}</small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="hint">{strings.submitFullTest.allReady}</p>
              )}
            </div>
          </Modal>
        </section>
      )}
    </div>
  );
}
