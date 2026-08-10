import { type FormEvent, useEffect, useMemo, useState } from "react";
import { lockBodyScroll } from "@/utils/scrollLock";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { confirmDelete } from "@/components/confirmDialog";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import type {
  ExamModule,
  ExamModuleAsset,
  ExamModulePart,
  ExamModuleQuestion,
  ExamModuleType,
  IeltsSection,
  QuestionDraft,
  QuestionImportPreview,
} from "@/api/types";
import { moduleEditorStrings as strings } from "./ModuleEditor.strings";
import { ANSWER_FREE_TYPES, CHOICE_TYPES, COMPOSITE_TYPES, MODULE_TYPES, SOURCE_SECTIONS, detectConversationSpeakers, emptyQuestion, questionPayload } from "./helpers";
import { NewModuleForm } from "./components/NewModuleForm";
import { ModulePartNav } from "./components/ModulePartNav";
import { ModuleReadinessPanel } from "./components/ModuleReadinessPanel";
import { ModuleDetailsForm, type ModuleDetailsState } from "./components/ModuleDetailsForm";
import { PartSpecPanel } from "./components/PartSpecPanel";
import { ListeningAudioPanel } from "./components/ListeningAudioPanel";
import { SpeakingTimingPanel } from "./components/SpeakingTimingPanel";
import { ManualQuestionForm } from "./components/ManualQuestionForm";
import { BulkImportForm } from "./components/BulkImportForm";
import { ImportReviewPanel } from "./components/ImportReviewPanel";
import { SavedQuestionsList } from "./components/SavedQuestionsList";
import { Badge } from "@/components/ui";

export function ModuleEditor() {
  const { id, type: rawType } = useParams();
  const isNew = !id;
  const location = useLocation();
  const navigate = useNavigate();
  const requestedType = rawType && MODULE_TYPES.has(rawType as ExamModuleType) ? rawType as ExamModuleType : null;
  const [module, setModule] = useState<ExamModule | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [details, setDetails] = useState<ModuleDetailsState>({ title: "", description: "", instructions: "", duration_minutes: 1, show_onboarding_instructions: true, onboarding_instructions: [] });
  const [sourceModules, setSourceModules] = useState<ExamModule[]>([]);
  const [selectedSources, setSelectedSources] = useState<Record<IeltsSection, string>>({ listening: "", reading: "", writing: "", speaking: "" });
  const [loadingSources, setLoadingSources] = useState(false);
  const [manual, setManual] = useState<QuestionDraft | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<QuestionImportPreview | null>(null);
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set());
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioTitle, setAudioTitle] = useState("Listening audio");
  const [tts, setTts] = useState({ title: "Generated conversation", conversation: "", rate: "+0%" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [questionEntryMode, setQuestionEntryMode] = useState<"manual" | "bulk">("manual");
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showInfo = useToastStore((state) => state.showInfo);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  async function loadModule(preferredPartId?: number) {
    if (!id) return;
    const showFullPageLoader = !module;
    if (showFullPageLoader) setLoading(true);
    try {
      const { data } = await apiClient.get<ExamModule>(`/instructor/modules/${id}`);
      setModule(data);
      setDetails({
        title: data.title,
        description: data.description ?? "",
        instructions: data.instructions ?? "",
        duration_minutes: data.duration_minutes,
        show_onboarding_instructions: data.show_onboarding_instructions ?? true,
        onboarding_instructions: data.onboarding_instructions ?? [],
      });
      const selected = data.parts?.find((part) => part.id === (preferredPartId ?? selectedPartId)) ?? data.parts?.[0] ?? null;
      setSelectedPartId(selected?.id ?? null);
      if (selected) setManual(emptyQuestion(selected));
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.details.errors.load));
    } finally {
      if (showFullPageLoader) setLoading(false);
    }
  }

  useEffect(() => { loadModule(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => {
    if (!isNew || !requestedType || !COMPOSITE_TYPES.has(requestedType)) return;
    setLoadingSources(true);
    apiClient.get<ExamModule[]>("/instructor/modules")
      .then(({ data }) => setSourceModules(data.filter((item) => SOURCE_SECTIONS.includes(item.module_type as IeltsSection) && item.status !== "archived" && item.ready_to_publish)))
      .catch((err: unknown) => setError(extractErrorMessage(err, "Failed to load completed source modules.")))
      .finally(() => setLoadingSources(false));
  }, [isNew, requestedType]);

  useEffect(() => {
    if (!editingQuestionId) return;
    return lockBodyScroll();
  }, [editingQuestionId]);

  const selectedPart = useMemo(() => module?.parts?.find((part) => part.id === selectedPartId) ?? null, [module, selectedPartId]);
  const detectedTtsSpeakers = useMemo(() => detectConversationSpeakers(tts.conversation), [tts.conversation]);
  const isEditable = module?.status !== "archived";
  const moduleWorkspacePath = useMemo(() => {
    if (location.pathname.startsWith("/institute-instructor/modules")) return "/institute-instructor/modules";
    return "/super-admin/instructor/modules";
  }, [location.pathname]);

  function choosePart(part: ExamModulePart | null) {
    if (!part) {
      setSelectedPartId(null);
      setEditingQuestionId(null);
      setPreview(null);
      setImportFile(null);
      setError(null);
      document.getElementById("module-part-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setSelectedPartId(part.id);
    setManual(emptyQuestion(part));
    setEditingQuestionId(null);
    setPreview(null);
    setImportFile(null);
    setError(null);
    document.getElementById("module-part-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function createModule(event: FormEvent) {
    event.preventDefault();
    if (!requestedType) return;
    const isComposite = COMPOSITE_TYPES.has(requestedType);
    const sourceModuleIds = SOURCE_SECTIONS.map((section) => Number(selectedSources[section])).filter(Boolean);
    if (isComposite && sourceModuleIds.length !== SOURCE_SECTIONS.length) {
      setError(strings.newModule.validation);
      return;
    }
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModule>("/instructor/modules", {
        module_type: requestedType,
        title: details.title,
        description: details.description || null,
        instructions: details.instructions || null,
        duration_minutes: details.duration_minutes,
        show_onboarding_instructions: details.show_onboarding_instructions ?? true,
        onboarding_instructions: details.onboarding_instructions || null,
        source_module_ids: isComposite ? sourceModuleIds : [],
      });
      navigate(`${moduleWorkspacePath}/${data.id}`, { replace: true });
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.newModule.errors.create)); }
    finally { setBusy(false); }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault(); if (!module) return;
    const payload = {
      title: details.title,
      description: details.description || null,
      instructions: details.instructions || null,
      duration_minutes: details.duration_minutes,
      show_onboarding_instructions: details.show_onboarding_instructions ?? true,
      onboarding_instructions: details.onboarding_instructions || null,
    };
    const original = {
      title: module.title,
      description: module.description || null,
      instructions: module.instructions || null,
      duration_minutes: module.duration_minutes,
      show_onboarding_instructions: module.show_onboarding_instructions ?? true,
      onboarding_instructions: module.onboarding_instructions || null,
    };
    if (isEqual(original, payload)) { showInfo(noChangesMessage); return; }
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(`/instructor/modules/${module.id}`, payload);
      setModule(data); showSuccess(strings.details.notices.saved);
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.details.errors.save)); }
    finally { setBusy(false); }
  }

  function updateOption(index: number, text: string) {
    if (!manual) return;
    setManual({ ...manual, options: manual.options.map((option, current) => current === index ? { ...option, text } : option) });
  }

  function addOption() {
    if (!manual || !CHOICE_TYPES.has(manual.question_type) || manual.options.length >= 26) return;
    const key = String.fromCharCode(65 + manual.options.length);
    setManual({ ...manual, options: [...manual.options, { key, text: "" }] });
  }

  function removeOption(index: number) {
    if (!manual || !CHOICE_TYPES.has(manual.question_type) || manual.options.length <= 2) return;
    const remaining = manual.options.filter((_, current) => current !== index);
    const keyMap = new Map<string, string>();
    const options = remaining.map((option, nextIndex) => {
      const key = String.fromCharCode(65 + nextIndex);
      keyMap.set(option.key, key);
      return { ...option, key };
    });
    const correctAnswers = manual.correct_answers
      .map((answer) => keyMap.get(answer))
      .filter((answer): answer is string => Boolean(answer));
    setManual({
      ...manual,
      options,
      correct_answers: correctAnswers.length ? correctAnswers : [options[0]?.key ?? "A"],
    });
  }

  function toggleCorrect(key: string) {
    if (!manual) return;
    const answers = manual.question_type === "mcq_multiple"
      ? manual.correct_answers.includes(key) ? manual.correct_answers.filter((item) => item !== key) : [...manual.correct_answers, key]
      : [key];
    setManual({ ...manual, correct_answers: answers });
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart || !manual) return;
    setBusy(true); setError(null);
    try {
      const base = `/instructor/modules/${module.id}/parts/${selectedPart.id}/questions`;
      if (editingQuestionId) await apiClient.put(`${base}/${editingQuestionId}`, questionPayload(manual));
      else await apiClient.post(base, questionPayload(manual));
      const message = editingQuestionId ? strings.manualQuestion.notices.updated : strings.manualQuestion.notices.added(selectedPart.title);
      setEditingQuestionId(null); setManual(emptyQuestion(selectedPart));
      await loadModule(selectedPart.id); showSuccess(message);
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.manualQuestion.errors.save)); }
    finally { setBusy(false); }
  }

  function editQuestion(question: ExamModuleQuestion) {
    setEditingQuestionId(question.id);
    setManual({ question_type: question.question_type, prompt: question.prompt, instructions: question.instructions, passage: question.passage, image_path: question.image_path, image_url: question.image_url, options: question.options, correct_answers: question.correct_answers, interaction: question.interaction ?? {}, explanation: question.explanation, points: question.points, difficulty: question.difficulty });
  }

  async function uploadQuestionImage(file: File) {
    if (!module || !selectedPart) return;
    setUploadingImage(true); setError(null);
    try {
      const form = new FormData(); form.append("file", file);
      const { data } = await apiClient.post<{ image_path: string; image_url: string }>(
        `/instructor/modules/${module.id}/parts/${selectedPart.id}/question-image`,
        form,
      );
      setManual((current) => current ? { ...current, image_path: data.image_path, image_url: data.image_url } : current);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.manualQuestion.errors.imageUpload));
    } finally {
      setUploadingImage(false);
    }
  }

  function removeQuestionImage() {
    setManual((current) => current ? { ...current, image_path: null, image_url: null } : current);
  }

  async function deleteQuestion(question: ExamModuleQuestion) {
    if (!module || !selectedPart || !await confirmDelete(strings.manualQuestion.deleteConfirm, strings.manualQuestion.deleteConfirmTitle)) return;
    try { await apiClient.delete(`/instructor/modules/${module.id}/parts/${selectedPart.id}/questions/${question.id}`); await loadModule(selectedPart.id); }
    catch (err: unknown) { setError(extractErrorMessage(err, strings.manualQuestion.errors.delete)); }
  }

  async function previewImport(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart || !importFile) return;
    setBusy(true); setError(null); setPreview(null);
    try {
      const form = new FormData(); form.append("file", importFile);
      const { data } = await apiClient.post<QuestionImportPreview>(`/instructor/modules/${module.id}/parts/${selectedPart.id}/import-preview`, form);
      const allowed = selectedPart.answer_constraints.allowed_question_types ?? [];
      const requiredTurns = selectedPart.answer_constraints.required_turn_types ?? [];
      const groupSize = selectedPart.answer_constraints.questions_per_group ?? 1;
      const normalized = data.questions.map((question, index) => {
        const nextType = !allowed.length || allowed.includes(question.question_type) ? question.question_type : allowed[0];
        const turnType = question.interaction?.turn_type
          ?? requiredTurns[Math.min(index, requiredTurns.length - 1)]
          ?? selectedPart.answer_constraints.allowed_turn_types?.[0]
          ?? null;
        return {
          ...question,
          question_type: nextType,
          prompt: selectedPart.answer_constraints.inline_marker_required && !question.prompt.includes("{{blank}}")
            ? `${question.prompt} {{blank}}`
            : question.prompt,
          options: CHOICE_TYPES.has(nextType) ? question.options : [],
          correct_answers: ANSWER_FREE_TYPES.has(nextType) ? [] : question.correct_answers,
          interaction: {
            ...question.interaction,
            group_label: question.interaction?.group_label
              ?? (selectedPart.answer_constraints.group_label_required ? `Conversation ${Math.floor(index / groupSize) + 1}` : null),
            turn_type: turnType,
            preparation_seconds: question.interaction?.preparation_seconds ?? selectedPart.answer_constraints.preparation_seconds ?? null,
            response_seconds: question.interaction?.response_seconds ?? selectedPart.answer_constraints.response_seconds ?? null,
            adaptive_follow_up: question.interaction?.adaptive_follow_up ?? turnType === "follow_up",
          },
        };
      });
      const requiredPoints = selectedPart.max_marks && selectedPart.question_limit ? Number(selectedPart.max_marks) / selectedPart.question_limit : null;
      setPreview({ ...data, questions: normalized.map((question) => requiredPoints === null ? question : { ...question, points: requiredPoints }) });
      setSelectedImports(new Set(normalized.map((_, index) => index)));
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.bulkImport.errors.preview)); }
    finally { setBusy(false); }
  }

  function updatePreview(index: number, changes: Partial<QuestionDraft>) {
    setPreview((current) => current ? { ...current, questions: current.questions.map((question, currentIndex) => currentIndex === index ? { ...question, ...changes } : question) } : current);
  }

  async function commitImport() {
    if (!module || !selectedPart || !preview) return;
    const questions = preview.questions.filter((_, index) => selectedImports.has(index)).map(questionPayload);
    if (!questions.length) { showError(strings.bulkImport.errors.selectOne); return; }
    setBusy(true); setError(null);
    try {
      await apiClient.post(`/instructor/modules/${module.id}/parts/${selectedPart.id}/import`, { source_type: preview.source_type, source_filename: preview.source_filename, questions });
      setPreview(null); setImportFile(null); await loadModule(selectedPart.id); showSuccess(strings.bulkImport.notices.imported(questions.length, selectedPart.title));
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.bulkImport.errors.commit)); }
    finally { setBusy(false); }
  }

  async function uploadAudio(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart || !audioFile) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData(); form.append("title", audioTitle); form.append("file", audioFile);
      await apiClient.post(`/instructor/modules/${module.id}/parts/${selectedPart.id}/audio`, form);
      setAudioFile(null); await loadModule(selectedPart.id); showSuccess(strings.listeningAudio.notices.uploaded(selectedPart.title));
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.listeningAudio.errors.upload)); }
    finally { setBusy(false); }
  }

  async function saveSpeakingTiming(preparationSeconds: number, responseSeconds: number) {
    if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(
        `/instructor/modules/${module.id}/parts/${selectedPart.id}/speaking-timing`,
        { preparation_seconds: preparationSeconds, response_seconds: responseSeconds },
      );
      setModule(data);
      showSuccess(strings.speakingTiming.saved(selectedPart.title));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.speakingTiming.error));
    } finally {
      setBusy(false);
    }
  }

  async function togglePartAiEvaluation(enabled: boolean) {
    if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(
        `/instructor/modules/${module.id}/parts/${selectedPart.id}/ai-evaluation`,
        { ai_evaluation_enabled: enabled },
      );
      setModule(data);
      showSuccess(strings.partSpec.aiEvaluationSaved(selectedPart.title, enabled));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.partSpec.aiEvaluationError));
    } finally {
      setBusy(false);
    }
  }

  async function updatePartInstructions(instructions: string) {
    if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(
        `/instructor/modules/${module.id}/parts/${selectedPart.id}/instructions`,
        { instructions: instructions.trim() || null },
      );
      setModule(data);
      showSuccess(strings.partSpec.instructionsSaved(selectedPart.title));
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.partSpec.instructionsError));
    } finally {
      setBusy(false);
    }
  }

  async function generateAudio(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModuleAsset>(`/instructor/modules/${module.id}/parts/${selectedPart.id}/tts`, tts);
      setTts((current) => ({ ...current, conversation: "" })); await loadModule(selectedPart.id); showSuccess(strings.listeningAudio.notices.generated(data.tts_voice ?? "", selectedPart.title));
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.listeningAudio.errors.generate)); }
    finally { setBusy(false); }
  }

  async function deleteAudio(assetId: number) {
    if (!module || !selectedPart || !await confirmDelete("Are you sure you want to delete this audio file?", "Delete Audio File")) return;
    try { await apiClient.delete(`/instructor/modules/${module.id}/assets/${assetId}`); await loadModule(selectedPart.id); }
    catch (err: unknown) { showError(extractErrorMessage(err, strings.listeningAudio.errors.delete)); }
  }

  async function changeStatus(status: "draft" | "published" | "archived") {
    if (!module) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModule>(`/instructor/modules/${module.id}/status`, { status });
      setModule(data); showSuccess(status === "published" ? strings.details.notices.published : strings.details.notices.movedTo(status));
    } catch (err: unknown) { showError(extractErrorMessage(err, strings.details.notices.statusError)); }
    finally { setBusy(false); }
  }

  async function deleteModule() {
    if (!module || !await confirmDelete(strings.details.deleteConfirm(module.title), strings.details.deleteConfirmTitle)) return;
    setBusy(true); setError(null);
    try { await apiClient.delete(`/instructor/modules/${module.id}`); navigate(moduleWorkspacePath); }
    catch (err: unknown) { setError(extractErrorMessage(err, strings.details.errors.delete)); }
    finally { setBusy(false); }
  }

  if (isNew) {
    return (
      <NewModuleForm
        requestedType={requestedType}
        details={details}
        onDetailsChange={setDetails}
        sourceModules={sourceModules}
        selectedSources={selectedSources}
        onSelectedSourcesChange={setSelectedSources}
        loadingSources={loadingSources}
        busy={busy}
        error={error}
        moduleWorkspacePath={moduleWorkspacePath}
        onSubmit={createModule}
      />
    );
  }

  if (loading) return <p>{strings.loading}</p>;
  if (!module) return <div><p className="error-text">{error || strings.notFound}</p><Link to={moduleWorkspacePath}>{strings.backToModules}</Link></div>;

  return (
    <div className="module-editor-page">
      {/* Sleek Breadcrumb Navigation Bar */}
      <div className="module-editor-breadcrumb-bar">
        <div className="module-editor-breadcrumb-left">
          <Link to={moduleWorkspacePath} className="button secondary module-back-btn">
            <Icon name="arrowLeft" />
            All Modules
          </Link>
          <div className="breadcrumb-trail">
            <span className="breadcrumb-separator">/</span>
            <span 
              className={`section-chip section-${module.module_type}`}
              onClick={() => setSelectedPartId(null)}
              style={{ cursor: "pointer" }}
              title="Edit Module Details"
            >
              {module.module_label}
            </span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current-title">{module.title}</span>
          </div>
        </div>

        <div className="module-editor-breadcrumb-right">
          {/* Breadcrumb right empty or auxiliary controls */}
        </div>
      </div>

      {/* Sleek Bottom Floating Status Bar */}
      <div className="vh-bottom-floating-status-bar">
        <ModuleReadinessPanel module={module} busy={busy} onChangeStatus={changeStatus} onChoosePart={choosePart} />
        <Badge tone={module.status === "published" ? "green" : module.status === "archived" ? "gray" : "amber"}>
          {module.status}
        </Badge>
      </div>

      <div className="module-authoring-layout">
        <ModulePartNav parts={module.parts} selectedPartId={selectedPartId} onChoosePart={choosePart} />
        <main className="module-part-editor" id="module-part-editor">
          {!selectedPart ? (
            <ModuleDetailsForm
              module={module}
              details={details}
              onDetailsChange={setDetails}
              isEditable={isEditable}
              busy={busy}
              onSubmit={saveDetails}
              onDelete={deleteModule}
            />
          ) : (
            <>
              <PartSpecPanel
                part={selectedPart}
                isEditable={isEditable}
                busy={busy}
                onToggleAiEvaluation={togglePartAiEvaluation}
                onUpdateInstructions={updatePartInstructions}
                questionEntryMode={questionEntryMode}
                onEntryModeChange={setQuestionEntryMode}
              />

            {selectedPart.section_type === "listening" && (
              <ListeningAudioPanel
                part={selectedPart}
                isEditable={isEditable}
                audioTitle={audioTitle}
                onAudioTitleChange={setAudioTitle}
                onAudioFileChange={setAudioFile}
                onUploadAudio={uploadAudio}
                tts={tts}
                onTtsChange={setTts}
                detectedTtsSpeakers={detectedTtsSpeakers}
                onGenerateAudio={generateAudio}
                busy={busy}
                audioFile={audioFile}
                onDeleteAudio={deleteAudio}
              />
            )}

            {selectedPart.section_type === "speaking" && (
              <>
                <SpeakingTimingPanel
                  part={selectedPart}
                  isEditable={isEditable}
                  busy={busy}
                  onSave={saveSpeakingTiming}
                />
              </>
            )}

            {isEditable && manual && (
              <div className="vh-entry-mode-wrapper">
                <div className="module-entry-tabbed-content">
                  {questionEntryMode === "manual" ? (
                    <ManualQuestionForm
                      part={selectedPart}
                      manual={manual}
                      editingQuestionId={editingQuestionId}
                      busy={busy}
                      uploadingImage={uploadingImage}
                      onAddOption={addOption}
                      onRemoveOption={removeOption}
                      onUpdateOption={updateOption}
                      onToggleCorrect={toggleCorrect}
                      onManualChange={setManual}
                      onUploadImage={uploadQuestionImage}
                      onRemoveImage={removeQuestionImage}
                      onSubmit={saveQuestion}
                      onCancelEdit={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}
                    />
                  ) : (
                    <BulkImportForm module={module} part={selectedPart} importFile={importFile} onImportFileChange={setImportFile} busy={busy} onSubmit={previewImport} />
                  )}
                </div>
              </div>
            )}

            {preview && (
              <ImportReviewPanel
                module={module}
                part={selectedPart}
                preview={preview}
                selectedImports={selectedImports}
                onSelectedImportsChange={setSelectedImports}
                onUpdatePreview={updatePreview}
                onDiscard={() => setPreview(null)}
                onCommit={commitImport}
                busy={busy}
              />
            )}

              <SavedQuestionsList part={selectedPart} isEditable={isEditable} onEdit={editQuestion} onDelete={deleteQuestion} />
            </>
          )}
        </main>
      </div>

      {editingQuestionId && selectedPart && manual && (
        <div className="modal-backdrop" onClick={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: "min(640px, 100%)", maxHeight: "95vh", overflowY: "auto", padding: 0, border: "none", background: "transparent", boxShadow: "none" }}>
            <ManualQuestionForm
              part={selectedPart}
              manual={manual}
              editingQuestionId={editingQuestionId}
              busy={busy}
              uploadingImage={uploadingImage}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              onUpdateOption={updateOption}
              onToggleCorrect={toggleCorrect}
              onManualChange={setManual}
              onUploadImage={uploadQuestionImage}
              onRemoveImage={removeQuestionImage}
              onSubmit={saveQuestion}
              onCancelEdit={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
