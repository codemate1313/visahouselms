import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { confirmDelete } from "../../components/confirmDialog";
import { SearchableSelect } from "../../components/SearchableSelect";
import type { Course, Question, QuestionBank, QuestionDraft, QuestionImportPreview, QuestionOption, QuestionType } from "../../api/types";
import { useAuthStore } from "../../store/authStore";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq_single", label: "MCQ — one answer" },
  { value: "mcq_multiple", label: "MCQ — multiple answers" },
  { value: "true_false_not_given", label: "True / False / Not Given" },
  { value: "yes_no_not_given", label: "Yes / No / Not Given" },
  { value: "short_answer", label: "Short answer" },
  { value: "fill_blank", label: "Fill in the blank" },
  { value: "essay", label: "Writing task" },
  { value: "speaking_prompt", label: "Speaking prompt" },
];

const CHOICE_TYPES = new Set<QuestionType>(["mcq_single", "mcq_multiple", "true_false_not_given", "yes_no_not_given"]);
const ANSWER_FREE_TYPES = new Set<QuestionType>(["essay", "speaking_prompt"]);

function defaultOptions(): QuestionOption[] {
  return ["A", "B", "C", "D"].map((key) => ({ key, text: "" }));
}

function emptyQuestion(): QuestionDraft {
  return { question_type: "mcq_single", prompt: "", instructions: null, passage: null, options: defaultOptions(), correct_answers: ["A"], explanation: null, points: 1, difficulty: "medium" };
}

function questionPayload(question: QuestionDraft) {
  return {
    question_type: question.question_type,
    prompt: question.prompt,
    instructions: question.instructions || null,
    passage: question.passage || null,
    options: CHOICE_TYPES.has(question.question_type) ? question.options.filter((option) => option.text.trim()) : [],
    correct_answers: ANSWER_FREE_TYPES.has(question.question_type) ? [] : question.correct_answers.map((answer) => answer.trim().toUpperCase()).filter(Boolean),
    explanation: question.explanation || null,
    points: Number(question.points),
    difficulty: question.difficulty,
  };
}

function typeLabel(type: QuestionType): string {
  return QUESTION_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function QuestionBankEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const [courses, setCourses] = useState<Course[]>([]);
  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [bankForm, setBankForm] = useState({ course_id: "", title: "", description: "", section: "reading" });
  const [manual, setManual] = useState<QuestionDraft>(emptyQuestion());
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<QuestionImportPreview | null>(null);
  const [selectedImports, setSelectedImports] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canEdit = isNew || (!!bank && bank.created_by_id === userId);

  async function loadBank() {
    if (isNew) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get<QuestionBank>(`/instructor/authoring/question-banks/${id}`);
      setBank(data);
      setBankForm({ course_id: String(data.course_id), title: data.title, description: data.description ?? "", section: data.section });
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load the question bank."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiClient.get<Course[]>("/instructor/courses").then(({ data }) => {
      setCourses(data.filter((course) => course.status !== "archived"));
      if (isNew && data.length) setBankForm((current) => ({ ...current, course_id: current.course_id || String(data[0].id) }));
    }).catch(() => setError("Failed to load courses."));
  }, [isNew]);
  useEffect(() => { loadBank(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function saveBank(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null); setNotice(null);
    const payload = { course_id: Number(bankForm.course_id), title: bankForm.title, description: bankForm.description || null, section: bankForm.section };
    try {
      if (isNew) {
        const { data } = await apiClient.post<QuestionBank>("/instructor/authoring/question-banks", payload);
        navigate(`/instructor/question-banks/${data.id}`, { replace: true });
      } else {
        const { data } = await apiClient.patch<QuestionBank>(`/instructor/authoring/question-banks/${id}`, payload);
        setBank(data); setNotice("Question bank details saved.");
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save the question bank."));
    } finally { setSaving(false); }
  }

  function changeQuestionType(type: QuestionType) {
    setManual((current) => {
      let options = current.options;
      let answers = current.correct_answers;
      if (type === "true_false_not_given") { options = ["True", "False", "Not Given"].map((text, index) => ({ key: String.fromCharCode(65 + index), text })); answers = ["A"]; }
      else if (type === "yes_no_not_given") { options = ["Yes", "No", "Not Given"].map((text, index) => ({ key: String.fromCharCode(65 + index), text })); answers = ["A"]; }
      else if (type.startsWith("mcq_") && !CHOICE_TYPES.has(current.question_type)) { options = defaultOptions(); answers = ["A"]; }
      else if (!CHOICE_TYPES.has(type)) { options = []; answers = ANSWER_FREE_TYPES.has(type) ? [] : [""]; }
      return { ...current, question_type: type, options, correct_answers: answers };
    });
  }

  function updateOption(index: number, text: string) {
    setManual((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, text } : option) }));
  }

  function addOption() {
    setManual((current) => current.options.length >= 26 ? current : ({ ...current, options: [...current.options, { key: String.fromCharCode(65 + current.options.length), text: "" }] }));
  }

  function removeOption(index: number) {
    setManual((current) => {
      const options = current.options.filter((_, optionIndex) => optionIndex !== index).map((option, optionIndex) => ({ ...option, key: String.fromCharCode(65 + optionIndex) }));
      const remainingText = current.options[index]?.text;
      const answers = current.correct_answers.filter((answer) => answer !== current.options[index]?.key && answer !== remainingText).map((answer) => {
        const oldIndex = current.options.findIndex((option) => option.key === answer);
        return oldIndex > index ? String.fromCharCode(64 + oldIndex) : answer;
      });
      return { ...current, options, correct_answers: answers };
    });
  }

  function toggleCorrect(key: string) {
    setManual((current) => ({
      ...current,
      correct_answers: current.question_type === "mcq_multiple"
        ? current.correct_answers.includes(key) ? current.correct_answers.filter((answer) => answer !== key) : [...current.correct_answers, key]
        : [key],
    }));
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault();
    if (!bank) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      if (editingQuestionId) await apiClient.put(`/instructor/authoring/question-banks/${bank.id}/questions/${editingQuestionId}`, questionPayload(manual));
      else await apiClient.post(`/instructor/authoring/question-banks/${bank.id}/questions`, questionPayload(manual));
      setManual(emptyQuestion()); setEditingQuestionId(null);
      await loadBank(); setNotice(editingQuestionId ? "Question updated." : "Question added.");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to save the question."));
    } finally { setSaving(false); }
  }

  function editQuestion(question: Question) {
    setEditingQuestionId(question.id);
    setManual({ question_type: question.question_type, prompt: question.prompt, instructions: question.instructions, passage: question.passage, options: question.options, correct_answers: question.correct_answers, explanation: question.explanation, points: question.points, difficulty: question.difficulty });
    document.getElementById("manual-question")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeQuestion(question: Question) {
    if (!bank || !await confirmDelete("Are you sure you want to delete this question?", "Delete Question")) return;
    try { await apiClient.delete(`/instructor/authoring/question-banks/${bank.id}/questions/${question.id}`); await loadBank(); }
    catch (err: unknown) { setError(extractErrorMessage(err, "Failed to delete the question.")); }
  }

  async function previewImport(event: FormEvent) {
    event.preventDefault(); if (!bank || !importFile) return;
    setImporting(true); setError(null); setNotice(null); setPreview(null);
    try {
      const formData = new FormData(); formData.append("file", importFile);
      const { data } = await apiClient.post<QuestionImportPreview>(`/instructor/authoring/question-banks/${bank.id}/import-preview`, formData);
      setPreview(data); setSelectedImports(new Set(data.questions.map((_, index) => index)));
    } catch (err: unknown) { setError(extractErrorMessage(err, "Could not extract questions from this file.")); }
    finally { setImporting(false); }
  }

  function updatePreviewQuestion(index: number, update: Partial<QuestionDraft>) {
    setPreview((current) => current ? ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...update } : question) }) : current);
  }

  function updatePreviewOption(questionIndex: number, optionIndex: number, text: string) {
    if (!preview) return;
    const question = preview.questions[questionIndex];
    updatePreviewQuestion(questionIndex, { options: question.options.map((option, index) => index === optionIndex ? { ...option, text } : option) });
  }

  async function commitImport() {
    if (!bank || !preview) return;
    const questions = preview.questions.filter((_, index) => selectedImports.has(index)).map(questionPayload);
    if (!questions.length) { setError("Select at least one extracted question."); return; }
    setImporting(true); setError(null);
    try {
      await apiClient.post(`/instructor/authoring/question-banks/${bank.id}/import`, { source_type: preview.source_type, source_filename: preview.source_filename, questions });
      const count = questions.length; setPreview(null); setImportFile(null); setSelectedImports(new Set()); await loadBank(); setNotice(`${count} questions imported.`);
      const input = document.getElementById("question-import-file") as HTMLInputElement | null; if (input) input.value = "";
    } catch (err: unknown) { setError(extractErrorMessage(err, "Review the highlighted content and try importing again.")); }
    finally { setImporting(false); }
  }

  function downloadTemplate() {
    const csv = "question_type,prompt,option_a,option_b,option_c,option_d,correct_answer,explanation,points,difficulty\nmcq_single,Which word is closest to rapid?,Slow,Fast,Quiet,Late,B,Fast means rapid.,1,easy\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "question-import-template.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  async function deleteBank() {
    if (!bank || !await confirmDelete(`Are you sure you want to delete “${bank.title}” and all of its questions?`, "Delete Question Bank")) return;
    try { await apiClient.delete(`/instructor/authoring/question-banks/${bank.id}`); navigate("/super-admin/instructor/question-banks"); }
    catch (err: unknown) { setError(extractErrorMessage(err, "Failed to delete the question bank.")); }
  }

  const questionCountLabel = useMemo(() => `${bank?.questions?.length ?? 0} question${bank?.questions?.length === 1 ? "" : "s"}`, [bank]);
  if (loading) return <p>Loading...</p>;

  return <div>
    <div className="page-header"><div><h1>{isNew ? "New Question Bank" : bank?.title}</h1>{bank && <p className="page-subtitle">{bank.course_title} · {questionCountLabel}</p>}</div><Link to="/super-admin/instructor/question-banks" className="text-link">← All question banks</Link></div>
    {error && <p className="error-text notice-line">{error}</p>}{notice && <p className="success-text notice-line">{notice}</p>}
    {!canEdit && <div className="banner warning">This bank is owned by {bank?.created_by_name}. You can view it, but only its creator can make changes.</div>}
    <form className="form-card wide bank-details-form" onSubmit={saveBank}>
      <h2>Bank details</h2>
      <div className="form-grid"><div><label htmlFor="bank-course">Course</label><SearchableSelect id="bank-course" options={courses.map((course) => ({ value: course.id, label: course.title }))} value={bankForm.course_id} onChange={(value) => setBankForm({ ...bankForm, course_id: String(value) })} disabled={!canEdit} searchPlaceholder="Search courses..." className="form-dropdown-select" /></div><div><label htmlFor="bank-section">IELTS section</label><SearchableSelect id="bank-section" options={[{ value: "listening", label: "Listening" }, { value: "reading", label: "Reading" }, { value: "writing", label: "Writing" }, { value: "speaking", label: "Speaking" }]} value={bankForm.section} onChange={(value) => setBankForm({ ...bankForm, section: String(value) })} disabled={!canEdit} searchable={false} className="form-dropdown-select" /></div></div>
      <label htmlFor="bank-title">Title</label><input id="bank-title" value={bankForm.title} onChange={(event) => setBankForm({ ...bankForm, title: event.target.value })} maxLength={200} required readOnly={!canEdit} />
      <label htmlFor="bank-description">Description</label><textarea id="bank-description" value={bankForm.description} onChange={(event) => setBankForm({ ...bankForm, description: event.target.value })} rows={3} maxLength={1000} readOnly={!canEdit} />
      {canEdit && <div className="form-actions"><button type="submit" disabled={saving || !bankForm.course_id}>{saving ? "Saving..." : isNew ? "Create Bank" : "Save Details"}</button>{bank && <button type="button" className="danger-text" onClick={deleteBank}>Delete bank</button>}</div>}
    </form>

    {bank && canEdit && <div className="authoring-split">
      <section className="authoring-panel" id="manual-question"><div className="panel-title"><div><span className="phase-chip">Single entry</span><h2>{editingQuestionId ? "Edit question" : "Add one question"}</h2></div></div>
        <QuestionForm question={manual} onChange={setManual} onTypeChange={changeQuestionType} onOptionChange={updateOption} onAddOption={addOption} onRemoveOption={removeOption} onToggleCorrect={toggleCorrect} onSubmit={saveQuestion} saving={saving} editing={!!editingQuestionId} onCancel={() => { setManual(emptyQuestion()); setEditingQuestionId(null); }} />
      </section>
      <section className="authoring-panel"><div className="panel-title"><div><span className="phase-chip">Bulk import</span><h2>Extract PDF or CSV</h2></div><button type="button" className="secondary-button compact-button" onClick={downloadTemplate}>CSV template</button></div>
        <p className="hint">PDF format: numbered questions, choices such as “A. Choice”, and “Answer: B”. Text-based PDFs work now; scanned pages need OCR first.</p>
        <form className="import-upload" onSubmit={previewImport}><input id="question-import-file" type="file" accept=".pdf,.csv,application/pdf,text/csv" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} required /><button type="submit" disabled={!importFile || importing}>{importing ? "Extracting..." : "Extract & Review"}</button></form>
      </section>
    </div>}

    {preview && <section className="import-review"><div className="import-review-header"><div><h2>Review extracted content</h2><p>{preview.question_count} detected · {preview.warning_count} warnings · {preview.source_filename}</p></div><div className="review-actions"><button type="button" className="secondary-button" onClick={() => setSelectedImports(selectedImports.size === preview.questions.length ? new Set() : new Set(preview.questions.map((_, index) => index)))}>{selectedImports.size === preview.questions.length ? "Deselect all" : "Select all"}</button><button className="secondary-button" onClick={() => setPreview(null)}>Discard</button><button onClick={commitImport} disabled={importing || selectedImports.size === 0}>{importing ? "Importing..." : `Import ${selectedImports.size} Selected`}</button></div></div>
      {preview.warnings.length > 0 && <div className="import-warning"><strong>Check these items before import</strong><ul>{preview.warnings.slice(0, 12).map((warning, index) => <li key={index}>{warning}</li>)}</ul>{preview.warnings.length > 12 && <p>And {preview.warnings.length - 12} more warnings in the question cards.</p>}</div>}
      <details className="source-content"><summary>View extracted file text</summary><pre>{preview.source_text}</pre></details>
      <div className="preview-list">{preview.questions.map((question, index) => <article className={`preview-question${selectedImports.has(index) ? " selected" : ""}`} key={index}>
        <label className="preview-selector"><input type="checkbox" checked={selectedImports.has(index)} onChange={() => setSelectedImports((current) => { const next = new Set(current); if (next.has(index)) next.delete(index); else next.add(index); return next; })} /> Include question {index + 1}</label>
        <div className="form-grid"><div><label>Type</label><SearchableSelect options={QUESTION_TYPES} value={question.question_type} onChange={(value) => updatePreviewQuestion(index, { question_type: String(value) as QuestionType })} searchable={false} className="form-dropdown-select" /></div><div><label>Correct answer key(s)</label><input value={question.correct_answers.join(", ")} onChange={(event) => updatePreviewQuestion(index, { correct_answers: event.target.value.split(",").map((answer) => answer.trim().toUpperCase()).filter(Boolean) })} placeholder="B or A, C" /></div></div>
        <label>Question</label><textarea rows={3} value={question.prompt} onChange={(event) => updatePreviewQuestion(index, { prompt: event.target.value })} />
        {question.options.length > 0 && <div className="preview-options">{question.options.map((option, optionIndex) => <label key={option.key}><span>{option.key}</span><input value={option.text} onChange={(event) => updatePreviewOption(index, optionIndex, event.target.value)} /></label>)}</div>}
        {!!question.warnings?.length && <p className="question-warning">{question.warnings.join(" · ")}</p>}
      </article>)}</div>
    </section>}

    {bank && <section className="question-list-section"><div className="section-heading"><div><h2>Saved questions</h2><p>{questionCountLabel} in this reusable bank.</p></div></div>
      {!bank.questions?.length ? <div className="empty-state compact-empty"><h2>No questions yet</h2><p>Add one manually or import PDF/CSV content above.</p></div> : <div className="saved-question-list">{bank.questions.map((question, index) => <article className="saved-question" key={question.id}><div className="question-number">{index + 1}</div><div className="question-body"><div className="question-meta"><span>{typeLabel(question.question_type)}</span><span>{question.difficulty}</span><span>{question.points} pt</span><span>{question.source_type}{question.source_filename ? ` · ${question.source_filename}` : ""}</span></div><h3>{question.prompt}</h3>{question.options.length > 0 && <ol className="saved-options" type="A">{question.options.map((option) => <li className={question.correct_answers.includes(option.key) ? "correct" : ""} key={option.key}>{option.text}</li>)}</ol>}{question.correct_answers.length > 0 && !question.options.length && <p className="answer-line">Accepted: {question.correct_answers.join(", ")}</p>}</div>{canEdit && <div className="question-actions"><button className="secondary-button" onClick={() => editQuestion(question)}>Edit</button><button className="danger-text" onClick={() => removeQuestion(question)}>Delete</button></div>}</article>)}</div>}
    </section>}
  </div>;
}

interface QuestionFormProps {
  question: QuestionDraft;
  onChange: (question: QuestionDraft) => void;
  onTypeChange: (type: QuestionType) => void;
  onOptionChange: (index: number, text: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
  onToggleCorrect: (key: string) => void;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
}

function QuestionForm({ question, onChange, onTypeChange, onOptionChange, onAddOption, onRemoveOption, onToggleCorrect, onSubmit, onCancel, saving, editing }: QuestionFormProps) {
  const hasChoices = CHOICE_TYPES.has(question.question_type);
  return <form className="question-form" onSubmit={onSubmit}>
    <div className="form-grid"><div><label htmlFor="question-type">Question type</label><SearchableSelect id="question-type" options={QUESTION_TYPES} value={question.question_type} onChange={(value) => onTypeChange(String(value) as QuestionType)} searchable={false} className="form-dropdown-select" /></div><div><label htmlFor="question-difficulty">Difficulty</label><SearchableSelect id="question-difficulty" options={[{ value: "easy", label: "Easy" }, { value: "medium", label: "Medium" }, { value: "hard", label: "Hard" }]} value={question.difficulty} onChange={(value) => onChange({ ...question, difficulty: String(value) as QuestionDraft["difficulty"] })} searchable={false} className="form-dropdown-select" /></div></div>
    <label htmlFor="question-instructions">Instructions</label><input id="question-instructions" value={question.instructions ?? ""} onChange={(event) => onChange({ ...question, instructions: event.target.value })} placeholder="Optional directions shown above the question" />
    <label htmlFor="question-passage">Passage or context</label><textarea id="question-passage" value={question.passage ?? ""} onChange={(event) => onChange({ ...question, passage: event.target.value })} rows={4} placeholder="Optional reading passage, transcript, or speaking context" />
    <label htmlFor="question-prompt">Question</label><textarea id="question-prompt" value={question.prompt} onChange={(event) => onChange({ ...question, prompt: event.target.value })} rows={4} required />
    {hasChoices && <fieldset className="option-editor"><legend>Choices and correct answer</legend>{question.options.map((option, index) => <div className="option-edit-row" key={option.key}><label className="answer-picker" title="Mark correct"><input type={question.question_type === "mcq_multiple" ? "checkbox" : "radio"} name="correct-option" checked={question.correct_answers.includes(option.key)} onChange={() => onToggleCorrect(option.key)} /><span>{option.key}</span></label><input aria-label={`Option ${option.key}`} value={option.text} onChange={(event) => onOptionChange(index, event.target.value)} required /><button type="button" className="remove-option" aria-label={`Remove option ${option.key}`} disabled={question.options.length <= 2} onClick={() => onRemoveOption(index)}>×</button></div>)}{question.question_type.startsWith("mcq_") && <button type="button" className="secondary-button add-option" onClick={onAddOption}>+ Add choice</button>}</fieldset>}
    {!hasChoices && !ANSWER_FREE_TYPES.has(question.question_type) && <><label htmlFor="accepted-answers">Accepted answer(s)</label><input id="accepted-answers" value={question.correct_answers.join(", ")} onChange={(event) => onChange({ ...question, correct_answers: event.target.value.split(",").map((answer) => answer.trim()).filter(Boolean) })} placeholder="Separate alternatives with commas" required /></>}
    <div className="form-grid"><div><label htmlFor="question-points">Points</label><input id="question-points" type="number" min="0.01" max="9999" step="0.01" value={question.points} onChange={(event) => onChange({ ...question, points: event.target.value })} required /></div><div><label htmlFor="question-explanation">Answer explanation</label><input id="question-explanation" value={question.explanation ?? ""} onChange={(event) => onChange({ ...question, explanation: event.target.value })} placeholder="Optional feedback after grading" /></div></div>
    <div className="form-actions"><button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update Question" : "Add Question"}</button>{editing && <button type="button" onClick={onCancel}>Cancel edit</button>}</div>
  </form>;
}
