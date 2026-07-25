import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmDelete } from "@/components/confirmDialog";
import type { Assessment, Course, Question } from "@/api/types";
import { useAuthStore } from "@/store/authStore";
import { testEditorStrings as strings } from "./TestEditor.strings";
import { TestStatusBar } from "./components/TestStatusBar";
import { TestDetailsForm } from "./components/TestDetailsForm";
import { QuestionPickerPanel } from "./components/QuestionPickerPanel";
import { TestOrderPanel } from "./components/TestOrderPanel";

export function TestEditor() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const [courses, setCourses] = useState<Course[]>([]);
  const [test, setTest] = useState<Assessment | null>(null);
  const [available, setAvailable] = useState<Question[]>([]);
  const [questionIds, setQuestionIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [form, setForm] = useState({ course_id: "", title: "", description: "", assessment_type: "practice", duration_minutes: "", instructions: "" });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canEdit = isNew || (!!test && test.created_by_id === userId && test.status === "draft");

  async function loadQuestions(courseId: string) {
    if (!courseId) { setAvailable([]); return; }
    try {
      const { data } = await apiClient.get<Question[]>("/instructor/authoring/questions", { params: { course_id: courseId } });
      setAvailable(data);
    } catch { setError(strings.details.errors.loadQuestions); }
  }

  async function loadTest() {
    if (isNew) return;
    setLoading(true);
    try {
      const { data } = await apiClient.get<Assessment>(`/instructor/authoring/tests/${id}`);
      setTest(data);
      setQuestionIds((data.questions ?? []).map((question) => question.id));
      setForm({ course_id: String(data.course_id), title: data.title, description: data.description ?? "", assessment_type: data.assessment_type, duration_minutes: data.duration_minutes ? String(data.duration_minutes) : "", instructions: data.instructions ?? "" });
      await loadQuestions(String(data.course_id));
      setError(null);
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.details.errors.load)); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    apiClient.get<Course[]>("/instructor/courses").then(({ data }) => {
      const active = data.filter((course) => course.status !== "archived");
      setCourses(active);
      if (isNew && active.length) {
        setForm((current) => ({ ...current, course_id: current.course_id || String(active[0].id) }));
        loadQuestions(String(active[0].id));
      }
    }).catch(() => setError(strings.details.errors.loadCourses));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);
  useEffect(() => { loadTest(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  function payload() {
    return { course_id: Number(form.course_id), title: form.title, description: form.description || null, assessment_type: form.assessment_type, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null, instructions: form.instructions || null };
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null);
    try {
      if (isNew) {
        const { data } = await apiClient.post<Assessment>("/instructor/authoring/tests", payload());
        navigate(`/instructor/tests/${data.id}`, { replace: true });
      } else {
        const { data } = await apiClient.put<Assessment>(`/instructor/authoring/tests/${id}`, payload());
        setTest(data); setNotice(strings.details.notices.saved);
      }
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.details.errors.save)); }
    finally { setSaving(false); }
  }

  async function saveQuestions() {
    if (!test) return;
    setSaving(true); setError(null);
    try {
      const { data } = await apiClient.put<Assessment>(`/instructor/authoring/tests/${test.id}/questions`, { question_ids: questionIds });
      setTest(data); setQuestionIds((data.questions ?? []).map((question) => question.id)); setNotice(strings.testOrder.notices.saved);
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.testOrder.errors.save)); }
    finally { setSaving(false); }
  }

  function toggleQuestion(questionId: number) {
    setQuestionIds((current) => current.includes(questionId) ? current.filter((value) => value !== questionId) : [...current, questionId]);
  }

  function toggleAllFiltered() {
    const filteredIds = filtered.map((question) => question.id);
    const allChosen = filteredIds.length > 0 && filteredIds.every((qid) => questionIds.includes(qid));
    setQuestionIds((current) => allChosen ? current.filter((qid) => !filteredIds.includes(qid)) : Array.from(new Set([...current, ...filteredIds])));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    setQuestionIds((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function changeStatus(status: Assessment["status"]) {
    if (!test) return;
    setError(null);
    try {
      const { data } = await apiClient.post<Assessment>(`/instructor/authoring/tests/${test.id}/status`, { status });
      setTest(data); setNotice(strings.statusBar.statusChanged(status));
    } catch (err: unknown) { setError(extractErrorMessage(err, strings.statusBar.errors.changeStatus)); }
  }

  async function deleteTest() {
    if (!test || !await confirmDelete(strings.details.deleteConfirm(test.title), strings.details.deleteConfirmTitle)) return;
    try { await apiClient.delete(`/instructor/authoring/tests/${test.id}`); navigate("/super-admin/instructor/tests"); }
    catch (err: unknown) { setError(extractErrorMessage(err, strings.details.errors.delete)); }
  }

  const byId = useMemo(() => new Map(available.map((question) => [question.id, question])), [available]);
  const filtered = useMemo(
    () => available.filter((question) => (!section || question.section === section) && (!search || question.prompt.toLowerCase().includes(search.toLowerCase()) || question.bank_title?.toLowerCase().includes(search.toLowerCase()))),
    [available, search, section]
  );

  if (loading) return <p>{strings.loading}</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{isNew ? strings.newTest : test?.title}</h1>
          {test && (
            <p className="page-subtitle">
              {strings.typeLabels[test.assessment_type as keyof typeof strings.typeLabels]} · {test.course_title}
            </p>
          )}
        </div>
        <Link className="text-link" to="/super-admin/instructor/tests">
          {strings.allTestsLink}
        </Link>
      </div>
      {test && <TestStatusBar test={test} isOwner={test.created_by_id === userId} onChangeStatus={changeStatus} />}
      {error && <p className="error-text notice-line">{error}</p>}
      {notice && <p className="success-text notice-line">{notice}</p>}
      {!isNew && test?.created_by_id !== userId && <div className="banner warning">{strings.ownedByBanner(test?.created_by_name ?? "")}</div>}

      <TestDetailsForm
        isNew={isNew}
        test={test}
        courses={courses}
        form={form}
        onFormChange={setForm}
        onCourseChange={(courseId) => {
          setForm({ ...form, course_id: courseId });
          setQuestionIds([]);
          loadQuestions(courseId);
        }}
        canEdit={canEdit}
        saving={saving}
        onSubmit={saveDetails}
        onDelete={deleteTest}
      />

      {test && (
        <div className="test-builder-grid">
          <QuestionPickerPanel
            test={test}
            available={available}
            filtered={filtered}
            search={search}
            onSearchChange={setSearch}
            section={section}
            onSectionChange={setSection}
            questionIds={questionIds}
            canEdit={canEdit}
            onToggleQuestion={toggleQuestion}
            onToggleAllFiltered={toggleAllFiltered}
          />
          <TestOrderPanel
            test={test}
            questionIds={questionIds}
            byId={byId}
            canEdit={canEdit}
            saving={saving}
            onMoveQuestion={moveQuestion}
            onRemoveQuestion={toggleQuestion}
            onSave={saveQuestions}
          />
        </div>
      )}
    </div>
  );
}
