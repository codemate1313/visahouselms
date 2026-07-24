import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { confirmDelete } from "../../components/confirmDialog";
import { SearchableSelect } from "../../components/SearchableSelect";
import type {
  ExamModule,
  ExamModuleAsset,
  ExamModulePart,
  ExamModuleQuestion,
  ExamModuleType,
  IeltsSection,
  QuestionDraft,
  QuestionImportPreview,
  QuestionOption,
  QuestionType,
} from "../../api/types";

const MODULE_TYPES = new Set<ExamModuleType>(["reading", "speaking", "writing", "listening", "full_mock", "final_test"]);
const TYPE_LABELS: Record<ExamModuleType, string> = { reading: "Reading", speaking: "Speaking", writing: "Writing", listening: "Listening", full_mock: "Full Mock Test", final_test: "Final Test" };
const QUESTION_LABELS: Record<QuestionType, string> = {
  mcq_single: "MCQ — one answer",
  mcq_multiple: "MCQ — multiple answers",
  true_false_not_given: "True / False / Not Given",
  yes_no_not_given: "Yes / No / Not Given",
  short_answer: "Short answer",
  fill_blank: "Fill in the blank",
  essay: "Writing task",
  speaking_prompt: "Speaking prompt",
};
const CHOICE_TYPES = new Set<QuestionType>(["mcq_single", "mcq_multiple", "true_false_not_given", "yes_no_not_given"]);
const ANSWER_FREE_TYPES = new Set<QuestionType>(["essay", "speaking_prompt"]);
const COMPOSITE_TYPES = new Set<ExamModuleType>(["full_mock", "final_test"]);
const SOURCE_SECTIONS: IeltsSection[] = ["listening", "reading", "writing", "speaking"];

function optionsFor(type: QuestionType): QuestionOption[] {
  if (type === "true_false_not_given") return ["True", "False", "Not Given"].map((text, index) => ({ key: String.fromCharCode(65 + index), text }));
  if (type === "yes_no_not_given") return ["Yes", "No", "Not Given"].map((text, index) => ({ key: String.fromCharCode(65 + index), text }));
  if (type.startsWith("mcq_")) return ["A", "B", "C"].map((key) => ({ key, text: "" }));
  return [];
}

function emptyQuestion(part: ExamModulePart): QuestionDraft {
  const type = part.answer_constraints.allowed_question_types?.[0] ?? "short_answer";
  const points = part.max_marks && part.question_limit ? Number(part.max_marks) / part.question_limit : 1;
  return {
    question_type: type,
    prompt: "",
    instructions: null,
    passage: null,
    options: optionsFor(type),
    correct_answers: ANSWER_FREE_TYPES.has(type) ? [] : ["A"],
    explanation: null,
    points,
    difficulty: "medium",
  };
}

function questionPayload(question: QuestionDraft) {
  return {
    question_type: question.question_type,
    prompt: question.prompt.trim(),
    instructions: question.instructions?.trim() || null,
    passage: question.passage?.trim() || null,
    options: CHOICE_TYPES.has(question.question_type) ? question.options.filter((option) => option.text.trim()) : [],
    correct_answers: ANSWER_FREE_TYPES.has(question.question_type) ? [] : question.correct_answers.map((answer) => answer.trim().toUpperCase()).filter(Boolean),
    explanation: question.explanation?.trim() || null,
    points: Number(question.points),
    difficulty: question.difficulty,
  };
}

function detectConversationSpeakers(conversation: string): string[] {
  const speakerLine = /^\s*\[?([A-Za-z][A-Za-z0-9 ._'-]{0,39})\]?\s*:\s*.+$/;
  const speakers = new Map<string, string>();
  let foundSpeakerLine = false;
  let hasNarratorPreamble = false;
  conversation.split(/\r?\n/).forEach((line) => {
    const match = line.match(speakerLine);
    if (!match) {
      if (line.trim() && !foundSpeakerLine) hasNarratorPreamble = true;
      return;
    }
    foundSpeakerLine = true;
    const name = match[1].trim().replace(/\s+/g, " ");
    if (!speakers.has(name.toLowerCase())) speakers.set(name.toLowerCase(), name);
  });
  if (speakers.size && hasNarratorPreamble) return ["Narrator", ...speakers.values()];
  if (!speakers.size && conversation.trim()) return ["Narrator"];
  return [...speakers.values()];
}

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
      setError(extractErrorMessage(err, "Failed to load this module."));
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
      setError("Choose one completed Listening, Reading, Writing, and Speaking module.");
      return;
    }
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModule>("/instructor/modules", { module_type: requestedType, title: details.title, description: details.description || null, instructions: details.instructions || null, source_module_ids: isComposite ? sourceModuleIds : [] });
      navigate(`/instructor/modules/${data.id}`, { replace: true });
    } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to create the module.")); }
    finally { setBusy(false); }
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault(); if (!module) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const { data } = await apiClient.patch<ExamModule>(`/instructor/modules/${module.id}`, { title: details.title, description: details.description || null, instructions: details.instructions || null });
      setModule(data); setNotice("Module details saved.");
    } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to save module details.")); }
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
      const message = editingQuestionId ? "Question updated." : `Question added to ${selectedPart.title}.`;
      setEditingQuestionId(null); setManual(emptyQuestion(selectedPart));
      await loadModule(selectedPart.id); setNotice(message);
    } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to save the question.")); }
    finally { setBusy(false); }
  }

  function editQuestion(question: ExamModuleQuestion) {
    setEditingQuestionId(question.id);
    setManual({ question_type: question.question_type, prompt: question.prompt, instructions: question.instructions, passage: question.passage, options: question.options, correct_answers: question.correct_answers, explanation: question.explanation, points: question.points, difficulty: question.difficulty });
    document.getElementById("manual-module-question")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function deleteQuestion(question: ExamModuleQuestion) {
    if (!module || !selectedPart || !await confirmDelete("Are you sure you want to delete this question?", "Delete Question")) return;
    try { await apiClient.delete(`/instructor/modules/${module.id}/parts/${selectedPart.id}/questions/${question.id}`); await loadModule(selectedPart.id); }
    catch (err: unknown) { setError(extractErrorMessage(err, "Failed to delete the question.")); }
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
    } catch (err: unknown) { setError(extractErrorMessage(err, "Could not extract questions from this file.")); }
    finally { setBusy(false); }
  }

  function updatePreview(index: number, changes: Partial<QuestionDraft>) {
    setPreview((current) => current ? { ...current, questions: current.questions.map((question, currentIndex) => currentIndex === index ? { ...question, ...changes } : question) } : current);
  }

  async function commitImport() {
    if (!module || !selectedPart || !preview) return;
    const questions = preview.questions.filter((_, index) => selectedImports.has(index)).map(questionPayload);
    if (!questions.length) { setError("Select at least one extracted question."); return; }
    setBusy(true); setError(null);
    try {
      await apiClient.post(`/instructor/modules/${module.id}/parts/${selectedPart.id}/import`, { source_type: preview.source_type, source_filename: preview.source_filename, questions });
      setPreview(null); setImportFile(null); await loadModule(selectedPart.id); setNotice(`${questions.length} questions imported into ${selectedPart.title}.`);
    } catch (err: unknown) { setError(extractErrorMessage(err, "Review the extracted questions and try again.")); }
    finally { setBusy(false); }
  }

  async function uploadAudio(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart || !audioFile) return;
    setBusy(true); setError(null);
    try {
      const form = new FormData(); form.append("title", audioTitle); form.append("file", audioFile);
      await apiClient.post(`/instructor/modules/${module.id}/parts/${selectedPart.id}/audio`, form);
      setAudioFile(null); await loadModule(selectedPart.id); setNotice(`MP3 attached to ${selectedPart.title}.`);
    } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to upload the MP3.")); }
    finally { setBusy(false); }
  }

  async function generateAudio(event: FormEvent) {
    event.preventDefault(); if (!module || !selectedPart) return;
    setBusy(true); setError(null);
    try {
      const { data } = await apiClient.post<ExamModuleAsset>(`/instructor/modules/${module.id}/parts/${selectedPart.id}/tts`, tts);
      setTts((current) => ({ ...current, conversation: "" })); await loadModule(selectedPart.id); setNotice(`${data.tts_voice || "Automatic voices"} generated for ${selectedPart.title}.`);
    } catch (err: unknown) { setError(extractErrorMessage(err, "Text-to-speech could not generate the MP3.")); }
    finally { setBusy(false); }
  }

  async function deleteAudio(assetId: number) {
    if (!module || !selectedPart || !await confirmDelete("Are you sure you want to delete this audio file?", "Delete Audio File")) return;
    try { await apiClient.delete(`/instructor/modules/${module.id}/assets/${assetId}`); await loadModule(selectedPart.id); }
    catch (err: unknown) { setError(extractErrorMessage(err, "Failed to delete the audio.")); }
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
          setNotice("Avatar video generated.");
        } else if (job.status === "failed") {
          setAvatarGenerating(false);
          setError(job.result || "Avatar generation failed.");
        } else {
          setTimeout(poll, 3000);
        }
      };
      setTimeout(poll, 3000);
    } catch (err: unknown) {
      setAvatarGenerating(false);
      setError(extractErrorMessage(err, "Failed to start avatar generation."));
    }
  }

  async function changeStatus(status: "draft" | "published" | "archived") {
    if (!module) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const { data } = await apiClient.post<ExamModule>(`/instructor/modules/${module.id}/status`, { status });
      setModule(data); setNotice(status === "published" ? "Module published." : `Module moved to ${status}.`);
    } catch (err: unknown) { setError(extractErrorMessage(err, "The module status could not be changed.")); }
    finally { setBusy(false); }
  }

  async function deleteModule() {
    if (!module || !await confirmDelete(`Are you sure you want to permanently delete “${module.title}” and all of its questions and audio? Existing Full/Final Mock copies will not be affected.`, "Delete Module")) return;
    setBusy(true); setError(null);
    try { await apiClient.delete(`/instructor/modules/${module.id}`); navigate("/super-admin/instructor/modules"); }
    catch (err: unknown) { setError(extractErrorMessage(err, "Failed to delete the module.")); }
    finally { setBusy(false); }
  }

  if (isNew) {
    if (!requestedType) return <div className="empty-state"><h1>Unknown module type</h1><Link to="/super-admin/instructor/modules">Choose a valid module</Link></div>;
    const isComposite = COMPOSITE_TYPES.has(requestedType);
    const allSourcesSelected = SOURCE_SECTIONS.every((section) => selectedSources[section]);
    return <div><div className="page-header"><div><h1>New {TYPE_LABELS[requestedType]}</h1><p className="page-subtitle">The correct parts, timing, marks and assessment rubric will be created automatically.</p></div><Link to="/super-admin/instructor/modules">← All modules</Link></div>
      {error && <p className="error-text notice-line">{error}</p>}
      <form className="form-card module-create-form" onSubmit={createModule}>
        <span className={`section-chip section-${requestedType}`}>{TYPE_LABELS[requestedType]}</span>
        <label htmlFor="new-module-title">Module title</label>
        <input id="new-module-title" value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} placeholder={`${TYPE_LABELS[requestedType]} — Academic Set 1`} maxLength={200} required autoFocus />
        <label htmlFor="new-module-description">Description</label>
        <textarea id="new-module-description" rows={4} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} placeholder="What this module covers" />
        <label htmlFor="new-module-instructions">Candidate instructions</label>
        <textarea id="new-module-instructions" rows={4} value={details.instructions} onChange={(event) => setDetails({ ...details, instructions: event.target.value })} placeholder="Optional instructions shown before the assessment starts" />
        {isComposite && <section className="composite-source-panel">
          <h2>Choose completed source tests</h2>
          <p>The system makes an independent copy of all four tests and randomizes the questions within every assessment part. Deleting or editing a source later will not change this {TYPE_LABELS[requestedType]}.</p>
          {loadingSources && <p className="source-loading">Loading your completed tests...</p>}
          <div className="source-module-grid">
            {SOURCE_SECTIONS.map((section) => {
              const choices = sourceModules.filter((item) => item.module_type === section);
              return <div className="source-module-choice" key={section}>
                <label htmlFor={`source-${section}`}>{TYPE_LABELS[section]}</label>
                <SearchableSelect
                  id={`source-${section}`}
                  options={[{ value: "", label: `Select completed ${TYPE_LABELS[section]}` }, ...choices.map((item) => ({ value: item.id, label: `${item.title} · ${item.question_count} questions · ${item.status}` }))]}
                  value={selectedSources[section]}
                  onChange={(value) => setSelectedSources((current) => ({ ...current, [section]: String(value) }))}
                  searchPlaceholder={`Search ${TYPE_LABELS[section]} modules...`}
                  className="form-dropdown-select"
                />
                {!loadingSources && !choices.length && <small>No completed {TYPE_LABELS[section]} test is available. <Link to={`/super-admin/instructor/modules/new/${section}`}>Create one first</Link>.</small>}
              </div>;
            })}
          </div>
        </section>}
        <button type="submit" disabled={busy || (isComposite && !allSourcesSelected)}>{busy ? "Creating & randomizing..." : `Create ${TYPE_LABELS[requestedType]}`}</button>
      </form>
    </div>;
  }

  if (loading) return <p>Loading...</p>;
  if (!module) return <div><p className="error-text">{error || "Module not found."}</p><Link to="/super-admin/instructor/modules">Back to modules</Link></div>;

  return <div className="module-editor-page">
    <div className="page-header module-editor-header"><div><div className="module-title-line"><span className={`section-chip section-${module.module_type}`}>{module.module_label}</span><span className={`badge ${module.status === "published" ? "badge-green" : module.status === "archived" ? "badge-gray" : "badge-amber"}`}>{module.status}</span></div><h1>{module.title}</h1><p className="page-subtitle">{module.duration_minutes} minutes · {module.part_count} parts · {module.question_count} questions · {module.blueprint_version}</p></div><Link to="/super-admin/instructor/modules">← All modules</Link></div>
    {error && <p className="error-text notice-line">{error}</p>}{notice && <p className="success-text notice-line">{notice}</p>}

    <CollapsiblePanel className={`module-readiness ${module.ready_to_publish ? "is-ready" : "needs-work"}`} title={module.ready_to_publish ? "Ready to publish" : "Publishing checklist"} description={module.ready_to_publish ? "Every required part, mark and audio rule is satisfied." : "You can work in any order. These checks are enforced only when publishing."} badge={<span className={`badge ${module.ready_to_publish ? "badge-green" : "badge-amber"}`}>{module.ready_to_publish ? "Ready" : "Needs work"}</span>}>{!module.ready_to_publish && <ul>{module.validation_errors.map((message) => <li key={message}>{message}</li>)}</ul>}<div className="module-status-actions">{module.status === "draft" && <button onClick={() => changeStatus("published")} disabled={busy || !module.ready_to_publish}>Publish module</button>}{module.status === "published" && <><button className="secondary-button" onClick={() => changeStatus("draft")} disabled={busy}>Return to draft</button><button onClick={() => changeStatus("archived")} disabled={busy}>Archive</button></>}{module.status === "archived" && <button onClick={() => changeStatus("draft")} disabled={busy}>Restore as draft</button>}</div></CollapsiblePanel>

    <form className="form-card wide module-details collapsible-form-card" onSubmit={saveDetails}><CollapsiblePanel className="form-card-collapsible" title="Module details" description="The assessment type and official timing cannot drift from its blueprint." badge={<span className="count-chip">{module.duration_minutes} min</span>}><label htmlFor="module-title">Title</label><input id="module-title" value={details.title} onChange={(event) => setDetails({ ...details, title: event.target.value })} required readOnly={!isEditable} /><label htmlFor="module-description">Description</label><textarea id="module-description" rows={3} value={details.description} onChange={(event) => setDetails({ ...details, description: event.target.value })} readOnly={!isEditable} /><label htmlFor="module-instructions">Candidate instructions</label><textarea id="module-instructions" rows={3} value={details.instructions} onChange={(event) => setDetails({ ...details, instructions: event.target.value })} readOnly={!isEditable} /><div className="form-actions">{isEditable && <button type="submit" disabled={busy}>Save details</button>}{module.status === "draft" && <button type="button" className="danger-text" onClick={deleteModule} disabled={busy}>{busy ? "Working..." : "Delete draft"}</button>}</div></CollapsiblePanel></form>

    <div className="module-authoring-layout">
      <aside className="module-part-nav" aria-label="Assessment parts"><h2>Assessment parts</h2><p>Select a part before adding or uploading anything.</p><div className="module-part-list">{module.parts?.map((part) => <button className={part.id === selectedPartId ? "active" : ""} onClick={() => choosePart(part)} key={part.id}><span><strong>{part.title}</strong><small>{part.section_type} · {part.auto_marked ? "auto-marked" : "examiner-marked"}</small></span><span>{part.questions.length}{part.question_limit ? `/${part.question_limit}` : "+"}</span></button>)}</div></aside>
      {selectedPart && <main className="module-part-editor" id="module-part-editor">
        <CollapsiblePanel className="part-spec-card" title={selectedPart.title} description={selectedPart.skill_focus} eyebrow={selectedPart.section_type} badge={<span className="count-chip">{selectedPart.questions.length}{selectedPart.question_limit ? ` / ${selectedPart.question_limit}` : ""} questions</span>}>{selectedPart.instructions && <p className="part-instructions"><strong>Format:</strong> {selectedPart.instructions}</p>}<div className="part-facts"><span>{selectedPart.auto_marked ? "Auto-marked" : "Examiner-marked"}</span>{selectedPart.max_marks && <span>{selectedPart.max_marks} raw marks</span>}{selectedPart.answer_constraints.audio_plays && <span>Audio plays {selectedPart.answer_constraints.audio_plays}×</span>}{selectedPart.answer_constraints.minimum_words && <span>Minimum {selectedPart.answer_constraints.minimum_words} words</span>}{selectedPart.answer_constraints.maximum_words && <span>Maximum {selectedPart.answer_constraints.maximum_words} words</span>}</div>
          {!!selectedPart.rubric.length && <details className="rubric-details" open><summary>Assessment criteria — {selectedPart.rubric.length} × 8 marks</summary><div className="rubric-grid">{selectedPart.rubric.map((criterion) => <article key={criterion.criterion}><div><strong>{criterion.criterion}</strong><span>0–{criterion.max_marks}</span></div><p>{criterion.description}</p></article>)}</div></details>}
        </CollapsiblePanel>

        {selectedPart.section_type === "listening" && <section className="listening-audio-panel"><div className="panel-title"><div><span className="phase-chip">Required listening media</span><h2>Audio for {selectedPart.title}</h2><p>Upload an existing MP3 or turn a written conversation into an automatically voiced MP3.</p></div></div>{isEditable && <div className="audio-method-grid"><form onSubmit={uploadAudio}><h3>Upload MP3</h3><label htmlFor="audio-title">Audio title</label><input id="audio-title" value={audioTitle} onChange={(event) => setAudioTitle(event.target.value)} required /><label htmlFor="audio-file">MP3 file</label><input id="audio-file" type="file" accept=".mp3,audio/mpeg" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} required /><button type="submit" disabled={busy || !audioFile}>{busy ? "Working..." : "Attach MP3 to this part"}</button></form><form onSubmit={generateAudio}><h3>Generate multi-speaker MP3</h3><label htmlFor="tts-title">Audio title</label><input id="tts-title" value={tts.title} onChange={(event) => setTts({ ...tts, title: event.target.value })} required /><label htmlFor="tts-conversation">Conversation or transcript</label><textarea id="tts-conversation" rows={8} value={tts.conversation} onChange={(event) => setTts({ ...tts, conversation: event.target.value })} placeholder={"Interviewer: Welcome to today's discussion.\nStudent: Thank you. I am glad to be here.\nInterviewer: Let us begin."} required /><p className="hint">Put every person's name before their lines, for example <strong>Speaker A:</strong> or <strong>Sarah:</strong>. Reuse the same name to keep the same voice.</p><div className={`auto-voice-summary${detectedTtsSpeakers.length > 6 ? " has-error" : ""}`}><strong>{detectedTtsSpeakers.length ? `${detectedTtsSpeakers.length} speaker${detectedTtsSpeakers.length === 1 ? "" : "s"} detected` : "Waiting for conversation"}</strong><span>{detectedTtsSpeakers.length ? detectedTtsSpeakers.join(" · ") : "Voices will be assigned automatically."}</span>{detectedTtsSpeakers.length > 6 && <small>Use no more than six distinct speakers.</small>}</div><label htmlFor="tts-rate">Speaking rate</label><SearchableSelect id="tts-rate" options={[{ value: "-20%", label: "Slower" }, { value: "+0%", label: "Normal" }, { value: "+15%", label: "Faster" }]} value={tts.rate} onChange={(value) => setTts({ ...tts, rate: String(value) })} searchable={false} className="form-dropdown-select" /><button type="submit" disabled={busy || !tts.conversation.trim() || detectedTtsSpeakers.length > 6}>{busy ? "Generating voices..." : `Generate with ${detectedTtsSpeakers.length || 1} automatic voice${detectedTtsSpeakers.length <= 1 ? "" : "s"}`}</button></form></div>}
          <div className="part-audio-list">{!selectedPart.assets.length ? <p className="empty-message">No audio attached to this part yet.</p> : selectedPart.assets.map((asset) => <article key={asset.id}><div><strong>{asset.title}</strong><small>{asset.asset_type === "tts_mp3" ? `Generated voice · ${asset.tts_voice}` : asset.original_filename}</small></div><audio controls preload="metadata" src={`${API_BASE_URL}${asset.url}`}>Your browser does not support audio.</audio>{asset.transcript && <details><summary>Transcript</summary><p>{asset.transcript}</p></details>}{isEditable && <button className="danger-text" onClick={() => deleteAudio(asset.id)}>Delete</button>}</article>)}</div>
        </section>}

        {selectedPart.section_type === "speaking" && <section className="listening-audio-panel"><div className="panel-title"><div><span className="phase-chip">Optional presenter video</span><h2>Avatar for {selectedPart.title}</h2><p>Generate a talking-presenter video reading this part's prompts, so students see and hear an examiner rather than just text. Requires a D-ID key configured in Developer Settings — Speaking parts publish without one too.</p></div></div>{isEditable && <div className="form-actions"><button type="button" onClick={generateAvatar} disabled={avatarGenerating || !selectedPart.questions.length}>{avatarGenerating ? "Generating video... (about a minute)" : "Generate avatar video"}</button></div>}
          <div className="part-audio-list">{!selectedPart.assets.filter((a) => a.asset_type === "avatar_mp4").length ? <p className="empty-message">No avatar video generated yet.</p> : selectedPart.assets.filter((a) => a.asset_type === "avatar_mp4").map((asset) => <article key={asset.id}><div><strong>{asset.title}</strong></div><video controls preload="metadata" src={`${API_BASE_URL}${asset.url}`} style={{ maxWidth: 320 }}>Your browser does not support video.</video>{isEditable && <button className="danger-text" onClick={() => deleteAudio(asset.id)}>Delete</button>}</article>)}</div>
        </section>}

        {isEditable && manual && <div className="module-entry-grid"><section className="authoring-panel" id="manual-module-question"><div className="panel-title"><div><span className="phase-chip">Single entry</span><h2>{editingQuestionId ? "Edit question" : `Add to ${selectedPart.title}`}</h2></div></div><form className="question-form" onSubmit={saveQuestion}><label htmlFor="module-question-type">Question type</label><SearchableSelect id="module-question-type" options={(selectedPart.answer_constraints.allowed_question_types ?? []).map((type) => ({ value: type, label: QUESTION_LABELS[type] }))} value={manual.question_type} onChange={(value) => changeQuestionType(String(value) as QuestionType)} searchable={false} className="form-dropdown-select" /><label htmlFor="module-question-passage">Passage or context</label><textarea id="module-question-passage" rows={4} value={manual.passage ?? ""} onChange={(event) => setManual({ ...manual, passage: event.target.value })} placeholder="Optional passage, transcript context, visual description, or role-play setup" /><label htmlFor="module-question-prompt">Question or task prompt</label><textarea id="module-question-prompt" rows={4} value={manual.prompt} onChange={(event) => setManual({ ...manual, prompt: event.target.value })} required />{CHOICE_TYPES.has(manual.question_type) && <fieldset className="option-editor"><legend>Options and correct answer</legend>{manual.options.map((option, index) => <div className="option-edit-row" key={option.key}><label className="answer-picker"><input type={manual.question_type === "mcq_multiple" ? "checkbox" : "radio"} checked={manual.correct_answers.includes(option.key)} onChange={() => toggleCorrect(option.key)} /><span>{option.key}</span></label><input value={option.text} onChange={(event) => updateOption(index, event.target.value)} required /></div>)}</fieldset>}{!CHOICE_TYPES.has(manual.question_type) && !ANSWER_FREE_TYPES.has(manual.question_type) && <><label htmlFor="module-answers">Accepted answer(s)</label><input id="module-answers" value={manual.correct_answers.join(", ")} onChange={(event) => setManual({ ...manual, correct_answers: event.target.value.split(",").map((answer) => answer.trim()).filter(Boolean) })} placeholder="Separate alternatives with commas" required /></>}<div className="form-grid"><div><label htmlFor="module-points">Raw marks</label><input id="module-points" type="number" min="0.01" step="0.01" value={manual.points} onChange={(event) => setManual({ ...manual, points: event.target.value })} required /></div><div><label htmlFor="module-difficulty">Difficulty</label><SearchableSelect id="module-difficulty" options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} value={manual.difficulty} onChange={(value) => setManual({ ...manual, difficulty: String(value) as QuestionDraft["difficulty"] })} searchable={false} className="form-dropdown-select" /></div></div><label htmlFor="module-explanation">Marking note or answer explanation</label><textarea id="module-explanation" rows={3} value={manual.explanation ?? ""} onChange={(event) => setManual({ ...manual, explanation: event.target.value })} /><div className="form-actions"><button type="submit" disabled={busy}>{editingQuestionId ? "Update question" : "Add question"}</button>{editingQuestionId && <button type="button" className="secondary-button" onClick={() => { setEditingQuestionId(null); setManual(emptyQuestion(selectedPart)); }}>Cancel</button>}</div></form></section>
          <section className="authoring-panel"><div className="panel-title"><div><span className="phase-chip">Bulk import</span><h2>PDF or CSV → {selectedPart.title}</h2></div></div><p className="hint">This upload is permanently scoped to <strong>{module.title} / {selectedPart.title}</strong>. Extracted content is listed for review before saving.</p><form className="import-upload" onSubmit={previewImport}><input type="file" accept=".pdf,.csv,application/pdf,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} required /><button type="submit" disabled={busy || !importFile}>{busy ? "Extracting..." : "Extract & review"}</button></form></section></div>}

        {preview && <section className="import-review"><div className="import-review-header"><div><h2>Review extracted content</h2><p>{preview.question_count} detected from {preview.source_filename} → {module.title} / {selectedPart.title}</p></div><div className="review-actions"><button type="button" className="secondary-button" onClick={() => setSelectedImports(selectedImports.size === preview.questions.length ? new Set() : new Set(preview.questions.map((_, index) => index)))}>{selectedImports.size === preview.questions.length ? "Deselect all" : "Select all"}</button><button className="secondary-button" onClick={() => setPreview(null)}>Discard</button><button onClick={commitImport} disabled={busy || !selectedImports.size}>Import {selectedImports.size} selected</button></div></div>{preview.warnings.length > 0 && <div className="import-warning"><strong>Extraction warnings</strong><ul>{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}<details className="source-content"><summary>List extracted file text</summary><pre>{preview.source_text}</pre></details><div className="preview-list">{preview.questions.map((question, index) => <article className={`preview-question${selectedImports.has(index) ? " selected" : ""}`} key={index}><label className="preview-selector"><input type="checkbox" checked={selectedImports.has(index)} onChange={() => setSelectedImports((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} /> Include item {index + 1}</label><label>Question type</label><SearchableSelect options={(selectedPart.answer_constraints.allowed_question_types ?? []).map((type) => ({ value: type, label: QUESTION_LABELS[type] }))} value={question.question_type} onChange={(value) => updatePreview(index, { question_type: String(value) as QuestionType })} searchable={false} className="form-dropdown-select" ariaLabel={`Question ${index + 1} type`} /><label>Extracted question or prompt</label><textarea rows={3} value={question.prompt} onChange={(event) => updatePreview(index, { prompt: event.target.value })} />{!ANSWER_FREE_TYPES.has(question.question_type) && <><label>Correct answer key(s)</label><input value={question.correct_answers.join(", ")} onChange={(event) => updatePreview(index, { correct_answers: event.target.value.split(",").map((answer) => answer.trim()).filter(Boolean) })} /></>}{question.options.length > 0 && <ol className="saved-options" type="A">{question.options.map((option) => <li key={option.key}>{option.text}</li>)}</ol>}</article>)}</div></section>}

        <CollapsiblePanel className="question-list-section" title={`Saved content — ${selectedPart.title}`} description={`${selectedPart.questions.length}${selectedPart.question_limit ? ` of ${selectedPart.question_limit}` : ""} required questions`} badge={<span className="count-chip">{selectedPart.questions.length}</span>}>{!selectedPart.questions.length ? <div className="empty-state compact-empty"><h2>No content yet</h2><p>Add one item manually or upload a PDF/CSV specifically to this part.</p></div> : <div className="saved-question-list">{selectedPart.questions.map((question, index) => <article className="saved-question" key={question.id}><div className="question-number">{index + 1}</div><div className="question-body"><div className="question-meta"><span>{QUESTION_LABELS[question.question_type]}</span><span>{question.points} mark{Number(question.points) === 1 ? "" : "s"}</span><span>{question.source_type}{question.source_filename ? ` · ${question.source_filename}` : ""}</span></div><h3>{question.prompt}</h3>{question.passage && <p>{question.passage}</p>}{question.options.length > 0 && <ol className="saved-options" type="A">{question.options.map((option) => <li className={question.correct_answers.includes(option.key) ? "correct" : ""} key={option.key}>{option.text}</li>)}</ol>}</div>{isEditable && <div className="question-actions"><button className="secondary-button" onClick={() => editQuestion(question)}>Edit</button><button className="danger-text" onClick={() => deleteQuestion(question)}>Delete</button></div>}</article>)}</div>}</CollapsiblePanel>
      </main>}
    </div>
  </div>;
}
