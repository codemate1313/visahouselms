import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { confirmDelete } from "../../components/confirmDialog";
import { SearchableSelect } from "../../components/SearchableSelect";
import type { Assessment, Course, Question } from "../../api/types";
import { useAuthStore } from "../../store/authStore";

const TYPE_LABELS: Record<string, string> = { practice: "Practice test", module_mock: "Module mock", full_mock: "Full IELTS mock", final: "Final test" };

export function TestEditor() {
  const { id } = useParams(); const isNew = !id; const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id);
  const [courses, setCourses] = useState<Course[]>([]);
  const [test, setTest] = useState<Assessment | null>(null);
  const [available, setAvailable] = useState<Question[]>([]);
  const [questionIds, setQuestionIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("");
  const [form, setForm] = useState({ course_id: "", title: "", description: "", assessment_type: "practice", duration_minutes: "", instructions: "" });
  const [loading, setLoading] = useState(!isNew); const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null);
  const canEdit = isNew || (!!test && test.created_by_id === userId && test.status === "draft");

  async function loadQuestions(courseId: string) {
    if (!courseId) { setAvailable([]); return; }
    try { const { data } = await apiClient.get<Question[]>("/instructor/authoring/questions", { params: { course_id: courseId } }); setAvailable(data); }
    catch { setError("Failed to load this course's questions."); }
  }
  async function loadTest() {
    if (isNew) return; setLoading(true);
    try {
      const { data } = await apiClient.get<Assessment>(`/instructor/authoring/tests/${id}`);
      setTest(data); setQuestionIds((data.questions ?? []).map((question) => question.id));
      setForm({ course_id: String(data.course_id), title: data.title, description: data.description ?? "", assessment_type: data.assessment_type, duration_minutes: data.duration_minutes ? String(data.duration_minutes) : "", instructions: data.instructions ?? "" });
      await loadQuestions(String(data.course_id)); setError(null);
    } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to load the test.")); }
    finally { setLoading(false); }
  }
  useEffect(() => { apiClient.get<Course[]>("/instructor/courses").then(({ data }) => { const active = data.filter((course) => course.status !== "archived"); setCourses(active); if (isNew && active.length) { setForm((current) => ({ ...current, course_id: current.course_id || String(active[0].id) })); loadQuestions(String(active[0].id)); } }).catch(() => setError("Failed to load courses.")); }, [isNew]);
  useEffect(() => { loadTest(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  function payload() { return { course_id: Number(form.course_id), title: form.title, description: form.description || null, assessment_type: form.assessment_type, duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null, instructions: form.instructions || null }; }
  async function saveDetails(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null);
    try {
      if (isNew) { const { data } = await apiClient.post<Assessment>("/instructor/authoring/tests", payload()); navigate(`/instructor/tests/${data.id}`, { replace: true }); }
      else { const { data } = await apiClient.put<Assessment>(`/instructor/authoring/tests/${id}`, payload()); setTest(data); setNotice("Test details saved."); }
    } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to save test details.")); }
    finally { setSaving(false); }
  }
  async function saveQuestions() {
    if (!test) return; setSaving(true); setError(null);
    try { const { data } = await apiClient.put<Assessment>(`/instructor/authoring/tests/${test.id}/questions`, { question_ids: questionIds }); setTest(data); setQuestionIds((data.questions ?? []).map((question) => question.id)); setNotice("Question order saved."); }
    catch (err: unknown) { setError(extractErrorMessage(err, "Failed to save test questions.")); }
    finally { setSaving(false); }
  }
  function toggleQuestion(questionId: number) { setQuestionIds((current) => current.includes(questionId) ? current.filter((value) => value !== questionId) : [...current, questionId]); }
  function toggleAllFiltered() { const filteredIds = filtered.map((question) => question.id); const allChosen = filteredIds.length > 0 && filteredIds.every((qid) => questionIds.includes(qid)); setQuestionIds((current) => allChosen ? current.filter((qid) => !filteredIds.includes(qid)) : Array.from(new Set([...current, ...filteredIds]))); }
  function moveQuestion(index: number, direction: -1 | 1) { setQuestionIds((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  async function changeStatus(status: Assessment["status"]) { if (!test) return; setError(null); try { const { data } = await apiClient.post<Assessment>(`/instructor/authoring/tests/${test.id}/status`, { status }); setTest(data); setNotice(`Test moved to ${status}.`); } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to change test status.")); } }
  async function deleteTest() { if (!test || !await confirmDelete(`Are you sure you want to delete test “${test.title}”?`, "Delete Test")) return; try { await apiClient.delete(`/instructor/authoring/tests/${test.id}`); navigate("/super-admin/instructor/tests"); } catch (err: unknown) { setError(extractErrorMessage(err, "Failed to delete the test.")); } }

  const byId = useMemo(() => new Map(available.map((question) => [question.id, question])), [available]);
  const filtered = useMemo(() => available.filter((question) => (!section || question.section === section) && (!search || question.prompt.toLowerCase().includes(search.toLowerCase()) || question.bank_title?.toLowerCase().includes(search.toLowerCase()))), [available, search, section]);
  if (loading) return <p>Loading...</p>;
  return <div>
    <div className="page-header"><div><h1>{isNew ? "New Test" : test?.title}</h1>{test && <p className="page-subtitle">{TYPE_LABELS[test.assessment_type]} · {test.course_title}</p>}</div><Link className="text-link" to="/super-admin/instructor/tests">← All tests</Link></div>
    {test && <div className="course-status-bar"><div><span className={`badge badge-${test.status === "published" ? "green" : test.status === "draft" ? "amber" : "gray"}`}>{test.status}</span><span>{test.question_count} questions · {test.total_points} points{test.duration_minutes ? ` · ${test.duration_minutes} minutes` : ""}</span></div>{test.created_by_id === userId && <div className="status-actions">{test.status !== "draft" && <button className="secondary-button" onClick={() => changeStatus("draft")}>Move to draft</button>}{test.status === "draft" && <button onClick={() => changeStatus("published")}>Publish</button>}{test.status !== "archived" && <button className="secondary-button" onClick={() => changeStatus("archived")}>Archive</button>}</div>}</div>}
    {error && <p className="error-text notice-line">{error}</p>}{notice && <p className="success-text notice-line">{notice}</p>}
    {!isNew && test?.created_by_id !== userId && <div className="banner warning">This test is owned by {test?.created_by_name}. You can view it, but only its creator can change it.</div>}
    <form className="form-card wide test-details-form collapsible-form-card" onSubmit={saveDetails}><CollapsiblePanel className="form-card-collapsible" title="Test details" description="Configure course, type, title, instructions, and timing."><div className="form-grid"><div><label htmlFor="test-course">Course</label><SearchableSelect id="test-course" options={courses.map((course) => ({ value: course.id, label: course.title }))} value={form.course_id} disabled={!canEdit} onChange={(value) => { const course_id = String(value); setForm({ ...form, course_id }); setQuestionIds([]); loadQuestions(course_id); }} searchPlaceholder="Search courses..." className="form-dropdown-select" /></div><div><label htmlFor="test-type">Test type</label><SearchableSelect id="test-type" options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} value={form.assessment_type} disabled={!canEdit} onChange={(value) => setForm({ ...form, assessment_type: String(value) })} searchable={false} className="form-dropdown-select" /></div></div><label htmlFor="test-title">Title</label><input id="test-title" value={form.title} readOnly={!canEdit} onChange={(event) => setForm({ ...form, title: event.target.value })} required /><label htmlFor="test-description">Description</label><textarea id="test-description" rows={3} value={form.description} readOnly={!canEdit} onChange={(event) => setForm({ ...form, description: event.target.value })} /><label htmlFor="test-instructions">Student instructions</label><textarea id="test-instructions" rows={4} value={form.instructions} readOnly={!canEdit} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /><label htmlFor="test-duration">Time limit in minutes</label><input id="test-duration" type="number" min="1" max="600" value={form.duration_minutes} readOnly={!canEdit} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} placeholder="Leave empty for untimed" />{canEdit && <div className="form-actions"><button type="submit" disabled={saving || !form.course_id}>{saving ? "Saving..." : isNew ? "Create Test" : "Save Details"}</button>{test && <button type="button" className="danger-text" onClick={deleteTest}>Delete test</button>}</div>}</CollapsiblePanel></form>
    {test && <div className="test-builder-grid"><CollapsiblePanel className="authoring-panel" title="Course questions" description="Select questions to add to this test." badge={<span className="count-chip">{filtered.length} shown</span>}><div className="question-picker-filters"><input placeholder="Search questions..." value={search} onChange={(event) => setSearch(event.target.value)} /><SearchableSelect options={[{ value: "", label: "All sections" }, { value: "listening", label: "Listening" }, { value: "reading", label: "Reading" }, { value: "writing", label: "Writing" }, { value: "speaking", label: "Speaking" }]} value={section} onChange={(value) => setSection(String(value))} searchable={false} className="status-filter-select" />{canEdit && filtered.length > 0 && <button type="button" className="secondary-button" onClick={toggleAllFiltered}>{filtered.every((question) => questionIds.includes(question.id)) ? "Deselect all" : "Select all"}</button>}</div>{!available.length ? <div className="empty-state compact-empty"><h2>No questions available</h2><p>Create a question bank for {test.course_title} first.</p><Link className="button-link" to="/super-admin/instructor/question-banks/new">New Question Bank</Link></div> : <div className="question-picker-list">{filtered.map((question) => <label className={`question-picker-item${questionIds.includes(question.id) ? " chosen" : ""}`} key={question.id}><input type="checkbox" disabled={!canEdit} checked={questionIds.includes(question.id)} onChange={() => toggleQuestion(question.id)} /><span><strong>{question.prompt}</strong><small>{question.section} · {question.bank_title} · {question.points} pt</small></span></label>)}</div>}</CollapsiblePanel>
      <CollapsiblePanel className="authoring-panel selected-questions-panel" title="Test order" description="Students receive questions in this order." badge={<span className="count-chip">{questionIds.length}</span>}>{!questionIds.length ? <p className="empty-message">Select questions from the course bank.</p> : <ol className="test-order-list">{questionIds.map((questionId, index) => { const question = byId.get(questionId) ?? test.questions?.find((item) => item.id === questionId); return <li key={questionId}><div><strong>{question?.prompt ?? `Question ${questionId}`}</strong><small>{question?.section} · {question?.bank_title}</small></div>{canEdit && <div><button aria-label="Move up" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>↑</button><button aria-label="Move down" disabled={index === questionIds.length - 1} onClick={() => moveQuestion(index, 1)}>↓</button><button aria-label="Remove" className="danger-text" onClick={() => toggleQuestion(questionId)}>×</button></div>}</li>; })}</ol>}{canEdit && <button className="save-order-button" onClick={saveQuestions} disabled={saving}>{saving ? "Saving..." : "Save Question Order"}</button>}</CollapsiblePanel>
    </div>}
  </div>;
}
