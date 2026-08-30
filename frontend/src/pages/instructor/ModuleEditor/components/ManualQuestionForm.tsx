import type { FormEvent } from "react";
import { useRef, useState, useEffect } from "react";
import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
import { RequiredMark, RichTextEditor } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import type { ExamModulePart, QuestionDraft } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { ANSWER_FREE_TYPES, CHOICE_TYPES } from "../helpers";
import type { SpeakingExaminer } from "../speakingExaminer";
import { SpeakingAvatarPreview } from "./SpeakingAvatarPreview";
import { MinuteSecondInput } from "./MinuteSecondInput";

interface ManualQuestionFormProps {
  moduleId: number;
  /** The module's fixed Sonia examiner, shown above the editor. */
  examiner: SpeakingExaminer | null;
  part: ExamModulePart;
  manual: QuestionDraft;
  editingQuestionId: number | null;
  busy: boolean;
  uploadingImage: boolean;
  uploadingSpeakingPdf?: boolean;
  uploadingAudio?: boolean;
  isListeningPerQuestion?: boolean;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onUpdateOption: (index: number, text: string) => void;
  onToggleCorrect: (key: string) => void;
  onManualChange: (manual: QuestionDraft) => void;
  onUploadImage: (file: File) => void;
  onRemoveImage: () => void;
  onUploadSpeakingPdf?: (file: File) => void;
  onRemoveSpeakingPdf?: () => void;
  onUploadAudio?: (file: File) => void;
  onRemoveAudio?: () => void;
  onSubmit: (event: FormEvent) => void;
  onCancelEdit: () => void;
}

export function ManualQuestionForm({
  moduleId,
  examiner,
  part,
  manual,
  editingQuestionId,
  busy,
  uploadingImage,
  uploadingSpeakingPdf = false,
  uploadingAudio = false,
  isListeningPerQuestion = false,
  onAddOption,
  onRemoveOption,
  onUpdateOption,
  onToggleCorrect,
  onManualChange,
  onUploadImage,
  onRemoveImage,
  onUploadSpeakingPdf,
  onRemoveSpeakingPdf,
  onUploadAudio,
  onRemoveAudio,
  onSubmit,
  onCancelEdit,
}: ManualQuestionFormProps) {
  const t = strings.manualQuestion;
  const isReading = part.section_type === "reading";
  const isListening = part.section_type === "listening";
  const isListening1 = part.part_code === "listening_1";
  const showQuestionAudio = isListeningPerQuestion || (isListening && Boolean(manual.interaction?.audio_path || manual.interaction?.audio_url));
  const isSpeaking = part.section_type === "speaking";
  /* Speaking 3 and 4 each pair a headline task with a bank of follow-up
     questions, so this form follows the turn being authored rather than the
     part it sits in. A Part 3 follow-up is a spoken question like Part 1's -
     it needs no read-aloud text - and keying off `part_code` would demand one
     and label the whole screen "read aloud". */
  const speakingTurn = manual.interaction?.turn_type ?? null;
  const isSpeakingReadAloud = speakingTurn === "read_aloud";
  const isSpeakingPresentation = speakingTurn === "presentation";
  const isSpeakingQuestionOnly = isSpeaking && !isSpeakingReadAloud && !isSpeakingPresentation;
  const isReading1a = part.part_code === "reading_1a";
  const isReading1b = part.part_code === "reading_1b";
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [boldError, setBoldError] = useState(false);
  const allowedTurns = part.answer_constraints.allowed_turn_types ?? [];
  const isChoiceQuestion = CHOICE_TYPES.has(manual.question_type);
  const canRemoveOption = manual.options.length > 2;

  const questionIndex = editingQuestionId
    ? (part.questions.findIndex((q) => q.id === editingQuestionId) + 1 || 1)
    : (part.questions.length + 1);

  useEffect(() => {
    if (isListening1) {
      const targetPrompt = `Question ${questionIndex}`;
      if (manual.prompt !== targetPrompt) {
        onManualChange({ ...manual, prompt: targetPrompt });
      }
    }
  }, [isListening1, questionIndex, manual, manual.prompt, onManualChange]);
  const showsBlankGuidance =
    (manual.question_type === "fill_blank" ||
      part.answer_constraints.inline_marker_required ||
      part.answer_constraints.layout === "inline_matching_blanks") &&
    !isReading1b;
  const reading1bGapIndex = editingQuestionId
    ? (part.questions.findIndex((q) => q.id === editingQuestionId) + 1 || 1)
    : (part.questions.length + 1);
  const candidateAttachmentType = manual.interaction?.candidate_material_path
    ? "pdf"
    : manual.image_path
      ? "image"
      : "none";
  const speakingPromptLabel = isSpeakingReadAloud
    ? "What Instructor says before read aloud"
    : isSpeakingPresentation
      ? "What Instructor says before the presentation"
      : "What Instructor asks";
  const speakingPromptHint = isSpeakingReadAloud
    ? "Private examiner instruction. Instructor says this first; the student reads the candidate-visible text aloud."
    : isSpeakingPresentation
      ? "Private examiner instruction. Instructor gives these instructions before the student sees and presents the material."
      : "Private examiner script. Instructor asks this aloud; it is not printed in the candidate workspace.";
  const speakingPromptPlaceholder = isSpeakingReadAloud
    ? "Example: You will now read the text aloud. You have 20 seconds to prepare."
    : isSpeakingPresentation
      ? "Example: Look at the image and prepare a short presentation. You have one minute to prepare."
      : "Enter Instructor's question or instruction for this turn";

  const questionNumber = editingQuestionId
    ? (part.questions.findIndex((q) => q.id === editingQuestionId) + 1)
    : (part.questions.length + 1);

  const placeholderPrompt = isSpeaking
    ? speakingPromptPlaceholder
    : isListening1
      ? `Question ${questionNumber}`
      : isReading1b
        ? `Gap ${questionNumber}`
        : part.answer_constraints.inline_marker_required
          ? t.inlinePromptPlaceholder
          : t.promptPlaceholder;
  const candidateTextLabel = isSpeakingReadAloud
    ? "Read-aloud text"
    : isSpeakingPresentation
      ? "Presentation notes or demographic text"
      : "Candidate-visible text";
  const candidateTextPlaceholder = isSpeakingReadAloud
    ? "Paste the exact text the student must read aloud"
    : isSpeakingPresentation
      ? "Add any labels, demographics, context, or written notes that should appear with the uploaded image"
      : "Optional text shown to the candidate, if this turn needs a visible card";
  const candidateWorkspaceHint = isSpeakingReadAloud
    ? "Add the exact text the student reads aloud. Instructor's instruction stays separate."
    : isSpeakingPresentation
      ? "Add the image/demographic material and optional text the student presents from. Instructor gives the custom instructions first."
      : "Instructor asks the question and the student answers. Add visible text only if this turn needs a card.";
  const speakingFlowTitle = isSpeakingReadAloud
    ? "Read-aloud setup"
    : isSpeakingPresentation
      ? "Presentation setup"
      : "Question-and-answer setup";
  const speakingFlowSteps = isSpeakingReadAloud
    ? ["Instructor gives the instruction", "Candidate reads the text", "Recording is saved"]
    : isSpeakingPresentation
      ? ["Instructor gives instructions", "Candidate views material", "Candidate presents"]
      : ["Instructor asks the question", "Candidate answers", "Recording is saved"];
  const hasVisibleCandidateMaterial = Boolean(manual.passage?.trim() || manual.image_url || manual.interaction?.candidate_material_url);
  /* Speaking 2 announces each role play before asking about it. The heading is
     its own field rather than the first line of the prompt because Instructor
     pauses between the two, and a pause cannot live inside one spoken line. */
  const allowsSpokenHeading = isSpeaking && Boolean(part.answer_constraints.spoken_heading);
  const headingText = manual.interaction?.heading ?? "";
  const headingGapSeconds = manual.interaction?.heading_gap_seconds
    ?? part.answer_constraints.default_heading_gap_seconds
    ?? 3;

  function toggleBoldSelection() {
    const el = promptRef.current;
    if (!el) return;
    const { selectionStart, selectionEnd, value } = el;
    if (selectionStart == null || selectionEnd == null || selectionStart === selectionEnd) return;
    const selected = value.slice(selectionStart, selectionEnd);
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const isBold = selected.startsWith("**") && selected.endsWith("**") && selected.length > 4;
    const nextSelected = isBold ? selected.slice(2, -2) : `**${selected}**`;
    const nextPrompt = `${before}${nextSelected}${after}`;
    onManualChange({ ...manual, prompt: nextPrompt });
    if (/\*\*(.+?)\*\*/.test(nextPrompt)) {
      setBoldError(false);
    }
    requestAnimationFrame(() => {
      el.focus();
      const cursor = before.length + nextSelected.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  function handleFormSubmit(event: FormEvent) {
    if (isReading1a && !/\*\*(.+?)\*\*/.test(manual.prompt)) {
      event.preventDefault();
      setBoldError(true);
      if (promptRef.current) promptRef.current.focus();
      return;
    }
    if (isReading1b && !manual.prompt?.trim()) {
      manual.prompt = `Gap ${reading1bGapIndex}`;
    }
    setBoldError(false);
    onSubmit(event);
  }

  return (
    <section className="authoring-panel" id="manual-module-question">
      {editingQuestionId && (
        <div className="panel-title">
          <div>
            <h2>{t.editHeading}</h2>
          </div>
        </div>
      )}
      <form className="question-form" onSubmit={handleFormSubmit}>
        {showsBlankGuidance && (
          <div className="question-authoring-help">
            <h4>{t.blankHelpTitle}</h4>
            <p>{t.blankHelp}</p>
          </div>
        )}
        {part.answer_constraints.group_label_required && (
          <>
            <label htmlFor="module-question-group">{t.groupLabel}<RequiredMark /></label>
            <input
              id="module-question-group"
              value={manual.interaction?.group_label ?? ""}
              onChange={(event) => onManualChange({
                ...manual,
                interaction: { ...manual.interaction, group_label: event.target.value },
              })}
              required
            />
          </>
        )}
        {allowedTurns.length > 0 && (
          <>

            {/* This prompt's own timing. There is no part-level default to
                inherit from: the part's duration, and the module's, are the sum
                of these numbers, so a prompt without a recording time cannot be
                saved. Zero preparation is a real choice - the candidate starts
                speaking the moment the examiner finishes. */}
            <div className="speaking-timing-fields">
              <MinuteSecondInput
                id="module-question-preparation"
                label={t.preparationSecondsLabel}
                minSeconds={0}
                maxSeconds={300}
                value={manual.interaction?.preparation_seconds ?? 0}
                onChange={(preparationSeconds) => onManualChange({
                  ...manual,
                  interaction: { ...manual.interaction, preparation_seconds: preparationSeconds },
                })}
              />
              <MinuteSecondInput
                id="module-question-response"
                label={t.responseSecondsLabel}
                minSeconds={1}
                maxSeconds={600}
                value={manual.interaction?.response_seconds ?? 0}
                onChange={(responseSeconds) => onManualChange({
                  ...manual,
                  interaction: { ...manual.interaction, response_seconds: responseSeconds },
                })}
              />
            </div>
            <p className="vh-speaking-timing-hint">
              {(manual.interaction?.preparation_seconds ?? 0) > 0
                ? "The candidate prepares, then recording starts on its own."
                : "No preparation: recording starts as soon as the examiner finishes speaking."}
            </p>
            {manual.interaction?.turn_type === "follow_up" && (
              <label className="checkbox-row" htmlFor="module-question-adaptive">
                <input
                  id="module-question-adaptive"
                  type="checkbox"
                  checked={Boolean(manual.interaction?.adaptive_follow_up)}
                  onChange={(event) => onManualChange({
                    ...manual,
                    interaction: { ...manual.interaction, adaptive_follow_up: event.target.checked },
                  })}
                />
                <span>{t.adaptiveFollowUpLabel}</span>
              </label>
            )}
          </>
        )}
        {isSpeaking && (
          <div className="vh-speaking-flow-guide" aria-label={`${part.title} speaking flow`}>
            <div>
              <span className="vh-speaking-flow-kicker">{part.title}</span>
              <strong>{speakingFlowTitle}</strong>
            </div>
            <ol>
              {speakingFlowSteps.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}
        {allowsSpokenHeading && (
          <div className="vh-speaking-heading-block">
            <label htmlFor="module-question-heading">{t.headingLabel}</label>
            <p className="hint">{t.headingHint}</p>
            <textarea
              id="module-question-heading"
              rows={2}
              value={headingText}
              maxLength={2000}
              placeholder={t.headingPlaceholder}
              onChange={(event) => onManualChange({
                ...manual,
                interaction: { ...manual.interaction, heading: event.target.value },
              })}
            />
            {headingText.trim().length > 0 && (
              <>
                <div className="speaking-timing-fields">
                  <MinuteSecondInput
                    id="module-question-heading-gap"
                    label={t.headingGapLabel}
                    minSeconds={0}
                    maxSeconds={120}
                    value={headingGapSeconds}
                    onChange={(gapSeconds) => onManualChange({
                      ...manual,
                      interaction: { ...manual.interaction, heading_gap_seconds: gapSeconds },
                    })}
                  />
                </div>
                <p className="vh-speaking-timing-hint">{t.headingGapHint(headingGapSeconds)}</p>
                <SpeakingAvatarPreview
                  moduleId={moduleId}
                  partId={part.id}
                  prompt={headingText}
                  examiner={examiner}
                  title={strings.avatarPreview.headingTitle}
                />
              </>
            )}
          </div>
        )}
        {/* 1. Question or task prompt */}
        {isListening1 ? (
          <div className="vh-listening-1-header" style={{ marginBottom: "20px" }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text, #0f172a)" }}>
              Question {questionIndex}
            </span>
          </div>
        ) : isReading1b ? (
          <div className="vh-reading-1b-gap-header" style={{ marginBottom: "16px", padding: "10px 14px", background: "rgba(185, 28, 43, 0.04)", borderRadius: "8px", border: "1px solid rgba(185, 28, 43, 0.15)" }}>
            <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--sa-sidebar-red, #b91c2b)" }}>
              Options for Gap {reading1bGapIndex}
            </span>
            <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Set the 3 options for <strong>{`{{blank:${reading1bGapIndex}}}`}</strong> in the passage above.
            </p>
          </div>
        ) : (
          <>
            <div className="vh-prompt-label-row">
              <label htmlFor="module-question-prompt">{isSpeaking ? speakingPromptLabel : t.promptLabel}<RequiredMark /></label>
              {isReading1a && (
                <Button
                  type="button"
                  variant="text"
                  className="vh-bold-toggle-button"
                  onClick={toggleBoldSelection}
                  title={t.boldSelectionHint}
                >
                  <strong>B</strong> {t.boldSelectionLabel}
                </Button>
              )}
            </div>
            {isReading1a && <p className="hint">{t.boldSelectionHint}</p>}
            {isSpeaking && <p className="hint">{speakingPromptHint}</p>}
            {part.section_type === "writing" || part.part_code.startsWith("writing_") ? (
              <RichTextEditor
                id="module-question-prompt"
                rows={6}
                value={manual.prompt}
                onChange={(nextPrompt) => onManualChange({ ...manual, prompt: nextPrompt })}
                placeholder={t.promptPlaceholder}
                required
              />
            ) : (
              <textarea
                id="module-question-prompt"
                ref={promptRef}
                rows={4}
                value={manual.prompt}
                onChange={(event) => {
                  onManualChange({ ...manual, prompt: event.target.value });
                  if (boldError && /\*\*(.+?)\*\*/.test(event.target.value)) {
                    setBoldError(false);
                  }
                }}
                placeholder={placeholderPrompt}
                style={boldError ? { borderColor: "var(--danger, #ef4444)", boxShadow: "0 0 0 1px var(--danger, #ef4444)" } : undefined}
                required
              />
            )}
            {isReading1a && boldError && (
              <p className="error-text" style={{ marginTop: "4px", fontSize: "12.5px", fontWeight: 500 }}>
                {t.errors.boldRequired}
              </p>
            )}
          </>
        )}

        {/* 1b. Examiner avatar preview - hear the question as the candidate will */}
        {isSpeaking && manual.prompt.trim().length > 0 && (
          <SpeakingAvatarPreview
            moduleId={moduleId}
            partId={part.id}
            prompt={manual.prompt}
            examiner={examiner}
          />
        )}

        {isSpeakingQuestionOnly && hasVisibleCandidateMaterial && (
          <section className="vh-speaking-material-builder is-compact" aria-labelledby="candidate-material-heading">
            <div className="vh-speaking-material-heading">
              <div>
                <span className="vh-speaking-material-kicker">Optional card</span>
                <h3 id="candidate-material-heading">Student-visible support</h3>
                <p>Leave empty for the normal flow where Instructor asks and the student answers.</p>
              </div>
              <span className="vh-speaking-material-optional">Optional</span>
            </div>

            <div className="vh-speaking-material-field">
              <label htmlFor="module-question-candidate-text">Support text</label>
              <RichTextEditor
                id="module-question-candidate-text"
                rows={4}
                value={manual.passage ?? ""}
                onChange={(next) => onManualChange({
                  ...manual,
                  passage: next,
                  interaction: {
                    ...manual.interaction,
                    candidate_material_type: candidateAttachmentType === "none" && next.trim() ? "text" : candidateAttachmentType,
                  },
                })}
                placeholder="Optional support text shown to the candidate"
              />
            </div>
            {manual.image_url && (
              <div className="vh-speaking-compact-file">
                <Icon name="image" />
                <span>Image support is attached.</span>
                <Button type="button" variant="text" className="vh-remove-img-btn" onClick={onRemoveImage}><Icon name="x" />Remove</Button>
              </div>
            )}
            {manual.interaction?.candidate_material_url && (
              <div className="vh-speaking-compact-file">
                <Icon name="filePdf" />
                <span>{manual.interaction.candidate_material_name || "PDF support is attached."}</span>
                <Button type="button" variant="text" className="vh-remove-img-btn" onClick={onRemoveSpeakingPdf}><Icon name="x" />Remove</Button>
              </div>
            )}
          </section>
        )}

        {isSpeaking && !isSpeakingQuestionOnly && (
          <section className="vh-speaking-material-builder" aria-labelledby="candidate-material-heading">
            <div className="vh-speaking-material-heading">
              <div>
                <span className="vh-speaking-material-kicker">Candidate workspace</span>
                <h3 id="candidate-material-heading">What the candidate sees</h3>
                <p>{candidateWorkspaceHint}</p>
              </div>
              <span className="vh-speaking-material-optional">{isSpeakingReadAloud ? "Required" : "Optional"}</span>
            </div>

            <div className="vh-speaking-material-field">
              <label htmlFor="module-question-candidate-text">{candidateTextLabel}{isSpeakingReadAloud ? <RequiredMark /> : null}</label>
              <RichTextEditor
                id="module-question-candidate-text"
                rows={6}
                value={manual.passage ?? ""}
                onChange={(next) => onManualChange({
                  ...manual,
                  passage: next,
                  interaction: {
                    ...manual.interaction,
                    candidate_material_type: candidateAttachmentType === "none" && next.trim() ? "text" : candidateAttachmentType,
                  },
                })}
                placeholder={candidateTextPlaceholder}
                required={isSpeakingReadAloud}
              />
            </div>

            {!isSpeakingReadAloud && (
            <div className="vh-speaking-attachment-grid">
              <div className="vh-speaking-attachment-card">
                <div className="vh-speaking-attachment-head">
                  <Icon name="image" />
                  <div>
                    <strong>{isSpeakingPresentation ? "Demographic/image attachment" : "Image attachment"}</strong>
                    <span>{isSpeakingPresentation ? "Upload the image, chart, or demographic the student presents from" : "Any supported raster image format"}</span>
                  </div>
                </div>
                {!manual.image_url ? (
                  <label className={`vh-dropzone-pill${uploadingImage || candidateAttachmentType === "pdf" ? " is-busy" : ""}`}>
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingImage || candidateAttachmentType === "pdf"}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUploadImage(file);
                        event.target.value = "";
                      }}
                    />
                    <div className="vh-dropzone-text">
                      <span className="vh-dropzone-main">{uploadingImage ? "Uploading image..." : "Upload image"}</span>
                      <span className="vh-dropzone-sub">{candidateAttachmentType === "pdf" ? "Remove PDF first to use an image" : "Supported raster image formats"}</span>
                    </div>
                    <span className="vh-dropzone-btn">Browse</span>
                  </label>
                ) : (
                  <div className="vh-image-preview-card">
                    <div className="vh-preview-header">
                      <span className="vh-preview-title">Candidate image</span>
                      <Button type="button" variant="text" className="vh-remove-img-btn" onClick={onRemoveImage}><Icon name="x" />Remove</Button>
                    </div>
                    <div className="vh-preview-image-wrapper">
                      <img src={`${API_BASE_URL}${manual.image_url}`} alt="Candidate speaking material" className="vh-large-preview-img" />
                    </div>
                  </div>
                )}
              </div>

              <div className="vh-speaking-attachment-card">
                <div className="vh-speaking-attachment-head">
                  <Icon name="filePdf" />
                  <div>
                    <strong>PDF attachment</strong>
                    <span>Use when the candidate should inspect a document</span>
                  </div>
                </div>
                {!manual.interaction?.candidate_material_url ? (
                  <label className={`vh-dropzone-pill${uploadingSpeakingPdf || candidateAttachmentType === "image" ? " is-busy" : ""}`}>
                    <input
                      type="file"
                      accept="application/pdf"
                      hidden
                      disabled={uploadingSpeakingPdf || candidateAttachmentType === "image"}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file && onUploadSpeakingPdf) onUploadSpeakingPdf(file);
                        event.target.value = "";
                      }}
                    />
                    <div className="vh-dropzone-text">
                      <span className="vh-dropzone-main">{uploadingSpeakingPdf ? "Uploading PDF..." : "Upload candidate PDF"}</span>
                      <span className="vh-dropzone-sub">{candidateAttachmentType === "image" ? "Remove image first to use a PDF" : "PDF up to 25 MB"}</span>
                    </div>
                    <span className="vh-dropzone-btn">Browse</span>
                  </label>
                ) : (
                  <div className="vh-speaking-pdf-card">
                    <Icon name="filePdf" />
                    <div>
                      <strong>{manual.interaction.candidate_material_name || "Candidate material.pdf"}</strong>
                      <span>Shown inside the candidate workspace</span>
                    </div>
                    <Button type="button" variant="text" className="vh-remove-img-btn" onClick={onRemoveSpeakingPdf}><Icon name="x" />Remove</Button>
                  </div>
                )}
              </div>
            </div>
            )}

            {candidateAttachmentType === "none" && !manual.passage?.trim() && (
              <p className="vh-speaking-material-empty">Leave this blank when the candidate should only see Instructor and the response controls.</p>
            )}
          </section>
        )}

        {/* 2. Sleek Interactive Image Dropzone Pill for non-speaking questions. */}
        {!isReading && !isListening && !isSpeaking && (
          <div className="vh-dropzone-pill-container">
            {!manual.image_url ? (
              <label className={`vh-dropzone-pill${uploadingImage ? " is-busy" : ""}`}>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploadingImage}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUploadImage(file);
                    event.target.value = "";
                  }}
                />
                <div className="vh-dropzone-icon-box">
                  <Icon name="image" />
                </div>
                <div className="vh-dropzone-text">
                  <span className="vh-dropzone-main">
                    {uploadingImage ? "Uploading image..." : "Attach Question Image (Optional)"}
                  </span>
                  <span className="vh-dropzone-sub">
                    Drag & drop image here or click to browse
                  </span>
                </div>
                <span className="vh-dropzone-btn">Browse</span>
              </label>
            ) : (
              <div className="vh-image-preview-card">
                <div className="vh-preview-header">
                  <span className="vh-preview-title">Question Image Attachment</span>
                  <Button type="button" variant="text" className="vh-remove-img-btn" onClick={onRemoveImage}>
                    <Icon name="x" />
                    Remove
                  </Button>
                </div>
                <div className="vh-preview-image-wrapper">
                  <img src={`${API_BASE_URL}${manual.image_url}`} alt={t.imagePreviewAlt} className="vh-large-preview-img" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2b. Question Audio Dropzone Pill (When in Option 2 / Per-question audio mode) */}
        {showQuestionAudio && (
          <div className="vh-dropzone-pill-container">
            {!manual.interaction?.audio_url && !manual.interaction?.audio_path ? (
              <label className={`vh-dropzone-pill${uploadingAudio ? " is-busy" : ""}`}>
                <input
                  type="file"
                  accept="audio/*"
                  hidden
                  disabled={uploadingAudio}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file && onUploadAudio) onUploadAudio(file);
                    event.target.value = "";
                  }}
                />
                <div className="vh-dropzone-icon-box">
                  <Icon name="play" />
                </div>
                <div className="vh-dropzone-text">
                  <span className="vh-dropzone-main">
                    {uploadingAudio ? "Uploading audio clip..." : "Attach Question Audio Clip (Option 2)"}
                  </span>
                  <span className="vh-dropzone-sub">
                    Drag & drop MP3 audio file here or click to browse
                  </span>
                </div>
                <span className="vh-dropzone-btn">Browse</span>
              </label>
            ) : (
              <div className="vh-image-preview-card">
                <div className="vh-preview-header">
                  <span className="vh-preview-title">Question Audio Clip</span>
                  <Button type="button" variant="text" className="vh-remove-img-btn" onClick={onRemoveAudio}>
                    <Icon name="x" />
                    Remove
                  </Button>
                </div>
                <div className="vh-preview-image-wrapper" style={{ padding: "12px 16px" }}>
                  <audio
                    controls
                    src={manual.interaction?.audio_url || `${API_BASE_URL}/storage/${manual.interaction?.audio_path}`}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* No per-question passage or instruction fields. A part that needs a
            source text owns one shared passage, edited in SharedPassagePanel
            above and copied down on save; every other part takes its source
            from the audio or the examiner voice, and its instruction line from
            the part heading. */}
        {isChoiceQuestion && (
          <div className="option-editor" role="group" aria-labelledby="module-options-heading">
            <div className="option-editor-header">
              <h3 id="module-options-heading">{t.optionsLegend}</h3>
              <Button type="button" variant="secondary" className="option-add-button" onClick={onAddOption}>
                <Icon name="plus" />
                {t.addOption}
              </Button>
            </div>
            {manual.options.map((option, index) => (
              <div className="option-edit-row" key={option.key}>
                <label className="answer-picker">
                  <input
                    type={manual.question_type === "mcq_multiple" ? "checkbox" : "radio"}
                    checked={manual.correct_answers.includes(option.key)}
                    onChange={() => onToggleCorrect(option.key)}
                  />
                  <span>{option.key}</span>
                </label>
                <input value={option.text} onChange={(event) => onUpdateOption(index, event.target.value)} required />
                <IconButton
                  icon={<Icon name="x" />}
                  label={t.removeOption(option.key)}
                  className="option-remove-button"
                  onClick={() => onRemoveOption(index)}
                  disabled={!canRemoveOption}
                  title={canRemoveOption ? t.removeOption(option.key) : t.minimumOptions}
                />
              </div>
            ))}
          </div>
        )}
        {!CHOICE_TYPES.has(manual.question_type) && !ANSWER_FREE_TYPES.has(manual.question_type) && (
          <>
            <label htmlFor="module-answers">{t.acceptedAnswersLabel}<RequiredMark /></label>
            <input
              id="module-answers"
              value={manual.correct_answers.join(", ")}
              onChange={(event) =>
                onManualChange({ ...manual, correct_answers: event.target.value.split(",").map((answer) => answer.trim()).filter(Boolean) })
              }
              placeholder={t.acceptedAnswersPlaceholder}
              required
            />
          </>
        )}

        <div className="form-actions">
          <Button type="submit" disabled={busy}>
            {editingQuestionId ? t.updateQuestion : t.addQuestion}
          </Button>
          {editingQuestionId && (
            <Button type="button" variant="secondary" onClick={onCancelEdit}>
              {t.cancel}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
