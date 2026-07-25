import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmDelete } from "@/components/confirmDialog";
import type { Course, Question, QuestionBank, QuestionDraft, QuestionImportPreview, QuestionType } from "@/api/types";
import { useAuthStore } from "@/store/authStore";
import { questionBankEditorStrings as strings } from "./QuestionBankEditor.strings";
import { ANSWER_FREE_TYPES, CHOICE_TYPES, defaultOptions, emptyQuestion, questionPayload } from "./helpers";
import { BankDetailsForm } from "./components/BankDetailsForm";
import { QuestionForm } from "./components/QuestionForm";
import { BulkImportPanel } from "./components/BulkImportPanel";
import { ImportReviewSection } from "./components/ImportReviewSection";
import { SavedQuestionsSection } from "./components/SavedQuestionsSection";

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
      setError(extractErrorMessage(err, strings.bankDetails.errors.load));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiClient.get<Course[]>("/instructor/courses").then(({ data }) => {
      setCourses(data.filter((course) => course.status !== "archived"));
      if (isNew && data.length) setBankForm((current) => ({ ...current, course_id: current.course_id || String(data[0].id) }));
    }).catch(() => setError(strings.bankDetails.errors.loadCourses));
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
        setBank(data); setNotice(strings.bankDetails.notices.saved);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.bankDetails.errors.save));
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
      await loadBank(); setNotice(editingQuestionId ? strings.manualQuestion.notices.updated : strings.manualQuestion.notices.added);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.manualQuestion.errors.save));
    } finally { setSaving(false); }
  }

  function editQuestion(question: Question) {
    setEditingQuestionId(question.id);
    setManual({ question_type: question.question_type, prompt: question.prompt, instructions: question.instructions, passage: question.passage, options: question.options, correct_answers: question.correct_answers, explanation: question.explanation, points: question.points, difficulty: question.difficulty });
    document.getElementById("manual-question")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeQuestion(question: Question) {
    if (!bank || !await confirmDelete(strings.manualQuestion.deleteConfirm, strings.manualQuestion.deleteConfirmTitle)) return;
    try { await apiClient.delete(`/instructor/authoring/question-banks/${bank.id}/questions/${question.id}`); await loadBank(); }
    catch (err: unknown) { setError(extractErrorMessage(err, strings.manualQuestion.errors.delete)); }
  }

  async function previewImport(event: FormEvent) {
    event.preventDefault(); if (!bank || !importFile) return;
    setImporting(true); setError(null); setNotice(null); setPreview(null);
    try {
      const formData = new FormData(); formData.append("file", importFile);
      const { data } = await apiClient.post<QuestionImportPreview>(`/instructor/authoring/question-banks/${bank.id}/import-preview`, formData);
      setPreview(data); setSelectedImports(new Set(data.questions.map((_, index) => index)));
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.bulkImport.errors.preview)); }
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
    if (!questions.length) { setError(strings.bulkImport.errors.selectOne); return; }
    setImporting(true); setError(null);
    try {
      await apiClient.post(`/instructor/authoring/question-banks/${bank.id}/import`, { source_type: preview.source_type, source_filename: preview.source_filename, questions });
      const count = questions.length; setPreview(null); setImportFile(null); setSelectedImports(new Set()); await loadBank(); setNotice(strings.bulkImport.notices.imported(count));
      const input = document.getElementById("question-import-file") as HTMLInputElement | null; if (input) input.value = "";
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.bulkImport.errors.commit)); }
    finally { setImporting(false); }
  }

  function downloadTemplate() {
    const csv = "question_type,prompt,option_a,option_b,option_c,option_d,correct_answer,explanation,points,difficulty\nmcq_single,Which word is closest to rapid?,Slow,Fast,Quiet,Late,B,Fast means rapid.,1,easy\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "question-import-template.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  async function deleteBank() {
    if (!bank || !await confirmDelete(strings.bankDetails.deleteConfirm(bank.title), strings.bankDetails.deleteConfirmTitle)) return;
    try { await apiClient.delete(`/instructor/authoring/question-banks/${bank.id}`); navigate("/super-admin/instructor/question-banks"); }
    catch (err: unknown) { setError(extractErrorMessage(err, strings.bankDetails.errors.delete)); }
  }

  const questionCountLabel = useMemo(() => strings.questionCountLabel(bank?.questions?.length ?? 0), [bank]);
  if (loading) return <p>{strings.loading}</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{isNew ? strings.newBank : bank?.title}</h1>
          {bank && (
            <p className="page-subtitle">
              {bank.course_title} · {questionCountLabel}
            </p>
          )}
        </div>
        <Link to="/super-admin/instructor/question-banks" className="text-link">
          {strings.allBanksLink}
        </Link>
      </div>
      {error && <p className="error-text notice-line">{error}</p>}
      {notice && <p className="success-text notice-line">{notice}</p>}
      {!canEdit && <div className="banner warning">{strings.ownedByBanner(bank?.created_by_name ?? "")}</div>}

      <BankDetailsForm
        isNew={isNew}
        bank={bank}
        bankForm={bankForm}
        onBankFormChange={setBankForm}
        courses={courses}
        canEdit={canEdit}
        saving={saving}
        onSubmit={saveBank}
        onDelete={deleteBank}
      />

      {bank && canEdit && (
        <div className="authoring-split">
          <section className="authoring-panel" id="manual-question">
            <div className="panel-title">
              <div>
                <span className="phase-chip">{strings.manualQuestion.eyebrow}</span>
                <h2>{editingQuestionId ? strings.manualQuestion.editHeading : strings.manualQuestion.addHeading}</h2>
              </div>
            </div>
            <QuestionForm
              question={manual}
              onChange={setManual}
              onTypeChange={changeQuestionType}
              onOptionChange={updateOption}
              onAddOption={addOption}
              onRemoveOption={removeOption}
              onToggleCorrect={toggleCorrect}
              onSubmit={saveQuestion}
              saving={saving}
              editing={!!editingQuestionId}
              onCancel={() => { setManual(emptyQuestion()); setEditingQuestionId(null); }}
            />
          </section>
          <BulkImportPanel
            importFile={importFile}
            onImportFileChange={setImportFile}
            importing={importing}
            onSubmit={previewImport}
            onDownloadTemplate={downloadTemplate}
          />
        </div>
      )}

      {preview && (
        <ImportReviewSection
          preview={preview}
          selectedImports={selectedImports}
          onSelectedImportsChange={setSelectedImports}
          onUpdatePreviewQuestion={updatePreviewQuestion}
          onUpdatePreviewOption={updatePreviewOption}
          onDiscard={() => setPreview(null)}
          onCommit={commitImport}
          importing={importing}
        />
      )}

      {bank && (
        <SavedQuestionsSection
          bank={bank}
          questionCountLabel={questionCountLabel}
          canEdit={canEdit}
          onEdit={editQuestion}
          onRemove={removeQuestion}
        />
      )}
    </div>
  );
}
