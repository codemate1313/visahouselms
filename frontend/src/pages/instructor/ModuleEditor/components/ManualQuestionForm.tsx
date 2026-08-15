import type { FormEvent } from "react";
import { useRef } from "react";
import { API_BASE_URL } from "@/api/client";
import { Icon } from "@/components/icons";
import { RequiredMark } from "@/components/ui";
import type { ExamModulePart, QuestionDraft, SpeakingTurnType } from "@/api/types";
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
  const isWriting = part.section_type === "writing";
  const isReading = part.section_type === "reading";
  const isListening = part.section_type === "listening";
  const isListening1 = part.part_code === "listening_1";
  const isSpeaking = part.section_type === "speaking";
  const isSpeakingQuestionOnly = part.part_code === "speaking_1" || part.part_code === "speaking_2";
  const isSpeakingReadAloud = part.part_code === "speaking_3";
  const isSpeakingPresentation = part.part_code === "speaking_4";
  const isReading1a = part.part_code === "reading_1a";
  const isReading1b = part.part_code === "reading_1b";
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const allowedTurns = part.answer_constraints.allowed_turn_types ?? [];
  const isChoiceQuestion = CHOICE_TYPES.has(manual.question_type);
  const canRemoveOption = manual.options.length > 2;
  const showsBlankGuidance =
    manual.question_type === "fill_blank" ||
    part.answer_constraints.inline_marker_required ||
    part.answer_constraints.layout === "inline_matching_blanks" ||
    isReading1b;
  const turnLabels: Record<SpeakingTurnType, string> = {
    identity: "Identity and origin",
    topic_question: "Familiar-topic question",
    roleplay_response: "Candidate responds in role play",
    roleplay_initiate: "Candidate initiates role play",
    read_aloud: "Read aloud",
    follow_up: "Follow-up question",
    presentation: "Extended presentation",
  };
  const candidateAttachmentType = manual.interaction?.candidate_material_path
    ? "pdf"
    : manual.image_path
      ? "image"
      : "none";
  const speakingPromptLabel = isSpeakingReadAloud
    ? "What Sonia says before read aloud"
    : isSpeakingPresentation
      ? "What Sonia says before the presentation"
      : "What Sonia asks";
  const speakingPromptHint = isSpeakingReadAloud
    ? "Private examiner instruction. Sonia says this first; the student reads the candidate-visible text aloud."
    : isSpeakingPresentation
      ? "Private examiner instruction. Sonia gives these instructions before the student sees and presents the material."
      : "Private examiner script. Sonia asks this aloud; it is not printed in the candidate workspace.";
  const speakingPromptPlaceholder = isSpeakingReadAloud
    ? "Example: You will now read the text aloud. You have 20 seconds to prepare."
    : isSpeakingPresentation
      ? "Example: Look at the image and prepare a short presentation. You have one minute to prepare."
      : "Enter Sonia's question or instruction for this turn";
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
    ? "Add the exact text the student reads aloud. Sonia's instruction stays separate."
    : isSpeakingPresentation
      ? "Add the image/demographic material and optional text the student presents from. Sonia gives the custom instructions first."
      : "For Parts 1 and 2, Sonia normally asks the question and the student answers. Add visible text only if this turn needs a card.";
  const speakingFlowTitle = isSpeakingReadAloud
    ? "Read-aloud setup"
    : isSpeakingPresentation
      ? "Presentation setup"
      : "Question-and-answer setup";
  const speakingFlowSteps = isSpeakingReadAloud
    ? ["Sonia gives the instruction", "Candidate reads the text", "Recording is saved"]
    : isSpeakingPresentation
      ? ["Sonia gives instructions", "Candidate views material", "Candidate presents"]
      : ["Sonia asks the question", "Candidate answers", "Recording is saved"];
  const hasVisibleCandidateMaterial = Boolean(manual.passage?.trim() || manual.image_url || manual.interaction?.candidate_material_url);

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
    onManualChange({ ...manual, prompt: `${before}${nextSelected}${after}` });
    requestAnimationFrame(() => {
      el.focus();
      const cursor = before.length + nextSelected.length;
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <section className="authoring-panel" id="manual-module-question">
      <div className="panel-title">
        <div>
          <h2>{editingQuestionId ? t.editHeading : t.addHeading(part.title)}</h2>
        </div>
      </div>
      <form className="question-form" onSubmit={onSubmit}>
        {showsBlankGuidance && (
          <div className="question-authoring-help">
            <h4>{t.blankHelpTitle}</h4>
            <p>{isReading1b ? t.blankHelpSharedCloze : t.blankHelp}</p>
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
            {isSpeaking && manual.interaction?.turn_type && (
              <div className="vh-speaking-auto-type">
                <span>Prompt type</span>
                <strong>{turnLabels[manual.interaction.turn_type]}</strong>
              </div>
            )}
            <div className="form-grid">
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
                minSeconds={5}
                maxSeconds={600}
                value={manual.interaction?.response_seconds ?? 60}
                onChange={(responseSeconds) => onManualChange({
                  ...manual,
                  interaction: { ...manual.interaction, response_seconds: responseSeconds },
                })}
              />
            </div>
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
        {/* 1. Question or task prompt */}
        <div className="vh-prompt-label-row">
          <label htmlFor="module-question-prompt">{isSpeaking ? speakingPromptLabel : isListening1 ? "Question" : t.promptLabel}<RequiredMark /></label>
          {isReading1a && (
            <button
              type="button"
              className="vh-bold-toggle-button"
              onClick={toggleBoldSelection}
              title={t.boldSelectionHint}
            >
              <strong>B</strong> {t.boldSelectionLabel}
            </button>
          )}
        </div>
        {isReading1a && <p className="hint">{t.boldSelectionHint}</p>}
        {isSpeaking && <p className="hint">{speakingPromptHint}</p>}
        <textarea
          id="module-question-prompt"
          ref={promptRef}
          rows={isListening1 ? 2 : 4}
          value={manual.prompt}
          onChange={(event) => onManualChange({ ...manual, prompt: event.target.value })}
          placeholder={isSpeaking ? speakingPromptPlaceholder : isListening1 ? "Question 1" : (part.answer_constraints.inline_marker_required ? t.inlinePromptPlaceholder : t.promptPlaceholder)}
          required
        />

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
                <p>Leave empty for the normal Part 1/2 flow where Sonia asks and the student answers.</p>
              </div>
              <span className="vh-speaking-material-optional">Optional</span>
            </div>

            <div className="vh-speaking-material-field">
              <label htmlFor="module-question-candidate-text">Support text</label>
              <textarea
                id="module-question-candidate-text"
                rows={4}
                value={manual.passage ?? ""}
                onChange={(event) => onManualChange({
                  ...manual,
                  passage: event.target.value,
                  interaction: {
                    ...manual.interaction,
                    candidate_material_type: candidateAttachmentType === "none" && event.target.value.trim() ? "text" : candidateAttachmentType,
                  },
                })}
                placeholder="Optional support text shown to the candidate"
              />
            </div>
            {manual.image_url && (
              <div className="vh-speaking-compact-file">
                <Icon name="image" />
                <span>Image support is attached.</span>
                <button type="button" className="vh-remove-img-btn" onClick={onRemoveImage}><Icon name="x" />Remove</button>
              </div>
            )}
            {manual.interaction?.candidate_material_url && (
              <div className="vh-speaking-compact-file">
                <Icon name="filePdf" />
                <span>{manual.interaction.candidate_material_name || "PDF support is attached."}</span>
                <button type="button" className="vh-remove-img-btn" onClick={onRemoveSpeakingPdf}><Icon name="x" />Remove</button>
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
              <textarea
                id="module-question-candidate-text"
                rows={6}
                value={manual.passage ?? ""}
                onChange={(event) => onManualChange({
                  ...manual,
                  passage: event.target.value,
                  interaction: {
                    ...manual.interaction,
                    candidate_material_type: candidateAttachmentType === "none" && event.target.value.trim() ? "text" : candidateAttachmentType,
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
                      <button type="button" className="vh-remove-img-btn" onClick={onRemoveImage}><Icon name="x" />Remove</button>
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
                    <button type="button" className="vh-remove-img-btn" onClick={onRemoveSpeakingPdf}><Icon name="x" />Remove</button>
                  </div>
                )}
              </div>
            </div>
            )}

            {candidateAttachmentType === "none" && !manual.passage?.trim() && (
              <p className="vh-speaking-material-empty">Leave this blank when the candidate should only see Sonia and the response controls.</p>
            )}
          </section>
        )}

        {/* 2. Sleek Interactive Image Dropzone Pill for non-speaking questions. */}
        {!isReading && !isListening1 && !isSpeaking && (
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
                  <button type="button" className="vh-remove-img-btn" onClick={onRemoveImage}>
                    <Icon name="x" />
                    Remove
                  </button>
                </div>
                <div className="vh-preview-image-wrapper">
                  <img src={`${API_BASE_URL}${manual.image_url}`} alt={t.imagePreviewAlt} className="vh-large-preview-img" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2b. Question Audio Dropzone Pill (For Listening Part 1) */}
        {isListening1 && (
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
                    {uploadingAudio ? "Uploading audio clip..." : "Attach Question Audio Clip (Optional)"}
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
                  <button type="button" className="vh-remove-img-btn" onClick={onRemoveAudio}>
                    <Icon name="x" />
                    Remove
                  </button>
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

        {/* When the part owns one shared source text, it is edited in
            SharedPassagePanel above and copied down on save - repeating the
            field here is what made identical-passage mistakes so easy.
            Listening questions carry no passage or per-question instructions
            either: the audio is the source and the part heading is the
            instruction. Speaking material is handled by the separate
            candidate-workspace builder above. */}
        {!isWriting && !isListening && !isSpeaking && !part.answer_constraints.shared_passage && (
          <>
            {/* 3. Passage or context */}
            <label htmlFor="module-question-passage">
              {t.passageLabel}
              {part.answer_constraints.passage_required && <RequiredMark />}
            </label>
            <textarea
              id="module-question-passage"
              rows={part.answer_constraints.shared_passage ? 8 : 4}
              value={manual.passage ?? ""}
              onChange={(event) => onManualChange({ ...manual, passage: event.target.value })}
              placeholder={t.passagePlaceholder}
              required={part.answer_constraints.passage_required}
            />

            {/* 4. Prompt instructions */}
            <label htmlFor="module-question-instructions">{t.instructionsLabel}</label>
            <textarea
              id="module-question-instructions"
              rows={2}
              value={manual.instructions ?? ""}
              onChange={(event) => onManualChange({ ...manual, instructions: event.target.value })}
            />
          </>
        )}
        {isChoiceQuestion && (
          <div className="option-editor" role="group" aria-labelledby="module-options-heading">
            <div className="option-editor-header">
              <h3 id="module-options-heading">{t.optionsLegend}</h3>
              <button type="button" className="option-add-button" onClick={onAddOption}>
                <Icon name="plus" />
                {t.addOption}
              </button>
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
                <button
                  type="button"
                  className="option-remove-button"
                  onClick={() => onRemoveOption(index)}
                  disabled={!canRemoveOption}
                  aria-label={t.removeOption(option.key)}
                  title={canRemoveOption ? t.removeOption(option.key) : t.minimumOptions}
                >
                  <Icon name="x" />
                </button>
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
          <button type="submit" disabled={busy}>
            {editingQuestionId ? t.updateQuestion : t.addQuestion}
          </button>
          {editingQuestionId && (
            <button type="button" className="secondary-button" onClick={onCancelEdit}>
              {t.cancel}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
