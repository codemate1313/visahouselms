import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmDelete } from "@/components/confirmDialog";
import type {
  ExamModule,
  ExamModuleAsset,
  ExamModulePart,
  ExamModuleQuestion,
  ExamModuleType,
  IeltsSection,
  QuestionDraft,
  QuestionImportPreview,
  QuestionType,
} from "@/api/types";
import { moduleEditorStrings as strings } from "./ModuleEditor.strings";
import { ANSWER_FREE_TYPES, CHOICE_TYPES, COMPOSITE_TYPES, MODULE_TYPES, SOURCE_SECTIONS, detectConversationSpeakers, emptyQuestion, optionsFor, questionPayload } from "./helpers";
import { NewModuleForm } from "./components/NewModuleForm";
import { ModulePartNav } from "./components/ModulePartNav";
import { ModuleReadinessPanel } from "./components/ModuleReadinessPanel";
import { ModuleDetailsForm } from "./components/ModuleDetailsForm";
import { PartSpecPanel } from "./components/PartSpecPanel";
import { ListeningAudioPanel } from "./components/ListeningAudioPanel";
import { SpeakingAvatarPanel } from "./components/SpeakingAvatarPanel";
import { ManualQuestionForm } from "./components/ManualQuestionForm";
import { BulkImportForm } from "./components/BulkImportForm";
import { ImportReviewPanel } from "./components/ImportReviewPanel";
import { SavedQuestionsList } from "./components/SavedQuestionsList";

export function ModuleEditor() {
  const { id, type: rawType } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const requestedType = rawType && MODULE_TYPES.has(rawType as ExamModuleType) ? rawType as ExamModuleType : null;
  const [module, setModule] = useState<ExamModule | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  const [details, setDetails] = useState({ title: "", description: "", instructions: "" });
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
  const [avatarGenerating, setAvatarGenerating] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadModule(preferredPartId?: number) {
    if (!id) return;
    const showFullPageLoader = !module;
    if (showFullPageLoader) setLoading(true);
    try {
      const { data } = await apiClient.get<ExamModule>(`/instructor/modules/${id}`);
      setModule(data);
      setDetails({ title: data.title, description: data.description ?? "", instructions: data.instructions ?? "" });
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

  const selectedPart = useMemo(() => module?.parts?.find((part) => part.id === selectedPartId) ?? null, [module, selectedPartId]);
  const detectedTtsSpeakers = useMemo(() => detectConversationSpeakers(tts.conversation), [tts.conversation]);
  const isEditable = module?.status !== "archived";

  function choosePart(part: ExamModulePart) {
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
      const { data } = await apiClient.post<ExamModule>("/instructor/modules", { module_type: requestedType, title: details.title, description: details.description || null, instructions: details.instructions || null, source_module_ids: isComposite ? sourceModuleIds : [] });
      navigate(`/instructor/modules/${data.id}`, { replace: true });
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.newModule.errors.create)); }
    finally { setBusy(false); }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault(); if (!module) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(`/instructor/modules/${module.id}`, { title: details.title, description: details.description || null, instructions: details.instructions || null });
      setModule(data); setNotice(strings.details.notices.saved);
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.details.errors.save)); }
    finally { setBusy(false); }
  }

  function changeQuestionType(type: QuestionType) {
    if (!manual) return;
    setManual({ ...manual, question_type: type, options: optionsFor(type), correct_answers: ANSWER_FREE_TYPES.has(type) ? [] : ["A"] });
  }

  function updateOption(index: number, text: string) {
    if (!manual) return;
    setManual({ ...manual, options: manual.options.map((option, current) => current === index ? { ...option, text } : option) });
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
    setBusy(true); setError(null); setNotice(null);
    try {
      const base = `/instructor/modules/${module.id}/parts/${selectedPart.id}/questions`;
      if (editingQuestionId) await apiClient.put(`${base}/${editingQuestionId}`, questionPayload(manual));
      else await apiClient.post(base, questionPayload(manual));
      const message = editingQuestionId ? strings.manualQuestion.notices.updated : strings.manualQuestion.notices.added(selectedPart.title);
      setEditingQuestionId(null); setManual(emptyQuestion(selectedPart));
      await loadModule(selectedPart.id); setNotice(message);
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.manualQuestion.errors.save)); }
    finally { setBusy(false); }
  }

  function editQuestion(question: ExamModuleQuestion) {
    setEditingQuestionId(question.id);
    setManual({ question_type: question.question_type, prompt: question.prompt, instructions: question.instructions, passage: question.passage, options: question.options, correct_answers: question.correct_answers, explanation: question.explanation, points: question.points, difficulty: question.difficulty });
    document.getElementById("manual-module-question")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      const normalized = data.questions.map((question) => {
        if (!allowed.length || allowed.includes(question.question_type)) return question;
        const nextType = allowed[0];
        return { ...question, question_type: nextType, options: CHOICE_TYPES.has(nextType) ? question.options : [], correct_answers: ANSWER_FREE_TYPES.has(nextType) ? [] : question.correct_answers };
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
    if (!questions.length) { setError(strings.bulkImport.errors.selectOne); return; }
    setBusy(true); setError(null);
    try {
      await apiClient.post(`/instructor/modules/${module.id}/parts/${selectedPart.id}/import`, { source_type: preview.source_type, source_filename: preview.source_filename, questions });
      setPreview(null); setImportFile(null); await loadModule(selectedPart.id); setNotice(strings.bulkImport.notices.imported(questions.length, selectedPart.title));
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.bulkImport.errors.commit)); }
    finally { setBusy(false); }
  }

  async function uploadAudio(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart || !audioFile) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData(); form.append("title", audioTitle); form.append("file", audioFile);
      await apiClient.post(`/instructor/modules/${module.id}/parts/${selectedPart.id}/audio`, form);
      setAudioFile(null); await loadModule(selectedPart.id); setNotice(strings.listeningAudio.notices.uploaded(selectedPart.title));
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.listeningAudio.errors.upload)); }
    finally { setBusy(false); }
  }

  async function generateAudio(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModuleAsset>(`/instructor/modules/${module.id}/parts/${selectedPart.id}/tts`, tts);
      setTts((current) => ({ ...current, conversation: "" })); await loadModule(selectedPart.id); setNotice(strings.listeningAudio.notices.generated(data.tts_voice ?? "", selectedPart.title));
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.listeningAudio.errors.generate)); }
    finally { setBusy(false); }
  }

  async function deleteAudio(assetId: number) {
    if (!module || !selectedPart || !await confirmDelete("Are you sure you want to delete this audio file?", "Delete Audio File")) return;
    try { await apiClient.delete(`/instructor/modules/${module.id}/assets/${assetId}`); await loadModule(selectedPart.id); }
    catch (err: unknown) { setError(extractErrorMessage(err, strings.listeningAudio.errors.delete)); }
  }

  async function generateAvatar() {
    if (!module || !selectedPart) return;
    setAvatarGenerating(true); setError(null);
    try {
      const { data } = await apiClient.post<{ job_id: number }>(`/instructor/modules/${module.id}/parts/${selectedPart.id}/avatar`);
      const partId = selectedPart.id;
      const poll = async () => {
        const { data: job } = await apiClient.get(`/instructor/modules/jobs/${data.job_id}`, { headers: { "X-Skip-Loader": "1" } });
        if (job.status === "done") {
          setAvatarGenerating(false);
          await loadModule(partId);
          setNotice(strings.speakingAvatar.generated);
        } else if (job.status === "failed") {
          setAvatarGenerating(false);
          setError(job.result || strings.speakingAvatar.failed);
        } else {
          setTimeout(poll, 3000);
        }
      };
      setTimeout(poll, 3000);
    } catch (err: unknown) {
      setAvatarGenerating(false);
      setError(extractErrorMessage(err, strings.speakingAvatar.errors.start));
    }
  }

  async function changeStatus(status: "draft" | "published" | "archived") {
    if (!module) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const { data } = await apiClient.post<ExamModule>(`/instructor/modules/${module.id}/status`, { status });
      setModule(data); setNotice(status === "published" ? strings.details.notices.published : strings.details.notices.movedTo(status));
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.details.notices.statusError)); }
    finally { setBusy(false); }
  }

  async function deleteModule() {
    if (!module || !await confirmDelete(strings.details.deleteConfirm(module.title), strings.details.deleteConfirmTitle)) return;
    setBusy(true); setError(null);
    try { await apiClient.delete(`/instructor/modules/${module.id}`); navigate("/super-admin/instructor/modules"); }
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
        onSubmit={createModule}
      />
    );
  }

  if (loading) return <p>{strings.loading}</p>;
  if (!module) return <div><p className="error-text">{error || strings.notFound}</p><Link to="/super-admin/instructor/modules">{strings.backToModules}</Link></div>;

  return (
    <div className="module-editor-page">
      <div className="page-header module-editor-header">
        <div>
          <div className="module-title-line">
            <span className={`section-chip section-${module.module_type}`}>{module.module_label}</span>
            <span className={`badge ${module.status === "published" ? "badge-green" : module.status === "archived" ? "badge-gray" : "badge-amber"}`}>{module.status}</span>
          </div>
          <h1>{module.title}</h1>
          <p className="page-subtitle">{strings.meta(module.duration_minutes, module.part_count, module.question_count, module.blueprint_version)}</p>
        </div>
        <Link to="/super-admin/instructor/modules">{strings.newModule.allModulesLink}</Link>
      </div>
      {error && <p className="error-text notice-line">{error}</p>}
      {notice && <p className="success-text notice-line">{notice}</p>}

      <ModuleReadinessPanel module={module} busy={busy} onChangeStatus={changeStatus} />
      <ModuleDetailsForm module={module} details={details} onDetailsChange={setDetails} isEditable={isEditable} busy={busy} onSubmit={saveDetails} onDelete={deleteModule} />

      <div className="module-authoring-layout">
        <ModulePartNav parts={module.parts} selectedPartId={selectedPartId} onChoosePart={choosePart} />
        {selectedPart && (
          <main className="module-part-editor" id="module-part-editor">
            <PartSpecPanel part={selectedPart} />

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
              <SpeakingAvatarPanel
                part={selectedPart}
                isEditable={isEditable}
                avatarGenerating={avatarGenerating}
                onGenerateAvatar={generateAvatar}
                onDeleteAudio={deleteAudio}
              />
            )}

            {isEditable && manual && (
              <div className="module-entry-grid">
                <ManualQuestionForm
                  part={selectedPart}
                  manual={manual}
                  editingQuestionId={editingQuestionId}
                  busy={busy}
                  onChangeQuestionType={changeQuestionType}
                  onUpdateOption={updateOption}
                  onToggleCorrect={toggleCorrect}
                  onManualChange={setManual}
                  onSubmit={saveQuestion}
                  onCancelEdit={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}
                />
                <BulkImportForm module={module} part={selectedPart} importFile={importFile} onImportFileChange={setImportFile} busy={busy} onSubmit={previewImport} />
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
          </main>
        )}
      </div>
    </div>
  );
}
