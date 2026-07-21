import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { confirmDelete } from "../../components/ConfirmModal";
import type { ExamModule, ExamModuleType, ModuleBlueprint } from "../../api/types";

const TYPE_ICONS: Record<ExamModuleType, string> = {
  reading: "R",
  speaking: "S",
  writing: "W",
  listening: "L",
  full_mock: "FM",
  final_test: "FT",
};

const TYPE_DETAIL: Record<ExamModuleType, string> = {
  reading: "5 parts · 30 auto-marked questions · 50 minutes",
  speaking: "4 equal-weight parts · five examiner criteria · 14 minutes",
  writing: "2 examiner-marked tasks · 32 marks each · 50 minutes",
  listening: "4 parts · 30 questions · MP3 or text-to-speech audio",
  full_mock: "Listening, Reading, Writing and Speaking · 15 parts",
  final_test: "Complete final assessment · all four skills · 15 parts",
};

export function Modules() {
  const [modules, setModules] = useState<ExamModule[]>([]);
  const [blueprints, setBlueprints] = useState<ModuleBlueprint[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ data: rows }, { data: templates }] = await Promise.all([
        apiClient.get<ExamModule[]>("/instructor/modules", { params: { search: search || undefined, module_type: type || undefined, status: status || undefined } }),
        apiClient.get<ModuleBlueprint[]>("/instructor/modules/blueprints"),
      ]);
      setModules(rows);
      setBlueprints(templates);
      setError(null);
    } catch {
      setError("Failed to load assessment modules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type, status]);
  function submit(event: FormEvent) { event.preventDefault(); load(); }
  async function deleteDraft(moduleId: number, title: string) {
    if (!await confirmDelete(`Are you sure you want to delete draft "${title}"?`, "Delete Draft Course")) return;
    try { await apiClient.delete(`/instructor/modules/${moduleId}`); await load(); }
    catch { setError("Failed to delete draft course."); }
  }

  return <div className="module-catalog">
    <div className="page-header">
      <div><h1>Courses</h1><p className="page-subtitle">Choose the assessment type, then build its questions and media inside the generated parts.</p></div>
    </div>

    <section className="module-type-grid" aria-label="Create an assessment module">
      {blueprints.map((blueprint) => <Link className={`module-type-card module-type-${blueprint.module_type}`} to={`/super-admin/instructor/modules/new/${blueprint.module_type}`} key={blueprint.module_type}>
        <span className="module-type-icon" aria-hidden="true">{TYPE_ICONS[blueprint.module_type]}</span>
        <div><h2>{blueprint.label}</h2><p>{TYPE_DETAIL[blueprint.module_type]}</p></div>
        <span className="module-create-label">Create →</span>
      </Link>)}
    </section>

    <div className="section-heading module-list-heading"><div><h2>Your courses</h2><p>Draft, validate, publish, and update each assessment course.</p></div></div>
    <form className="filter-bar responsive-filters" onSubmit={submit}>
      <input aria-label="Search courses" placeholder="Search courses..." value={search} onChange={(event) => setSearch(event.target.value)} />
      <select aria-label="Module type" value={type} onChange={(event) => setType(event.target.value)}><option value="">All types</option>{blueprints.map((item) => <option value={item.module_type} key={item.module_type}>{item.label}</option>)}</select>
      <select aria-label="Module status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select>
      <button type="submit">Search</button>
    </form>
    {error && <p className="error-text">{error}</p>}
    {loading ? <p>Loading...</p> : !modules.length ? <div className="empty-state"><h2>No modules found</h2><p>Choose one of the six module types above to begin.</p></div> : <div className="module-list-grid">
      {modules.map((module) => <article className="module-record-card" key={module.id}>
        <Link className="module-record-main" to={`/super-admin/instructor/modules/${module.id}`}>
          <div className="module-record-top"><span className={`section-chip section-${module.module_type}`}>{module.module_label}</span><span className={`badge ${module.status === "published" ? "badge-green" : module.status === "archived" ? "badge-gray" : "badge-amber"}`}>{module.status}</span></div>
          <h2>{module.title}</h2><p>{module.description || TYPE_DETAIL[module.module_type]}</p>
          <div className="module-record-metrics"><span><strong>{module.part_count}</strong> parts</span><span><strong>{module.question_count}</strong> questions</span><span><strong>{module.duration_minutes}</strong> min</span></div>
          <small className={module.ready_to_publish ? "ready-label" : "needs-work-label"}>{module.ready_to_publish ? "Ready to publish" : `${module.validation_errors.length} requirement${module.validation_errors.length === 1 ? "" : "s"} remaining`}</small>
        </Link>
        {module.status === "draft" && <button type="button" className="danger-text module-draft-delete" onClick={() => deleteDraft(module.id, module.title)}>Delete draft</button>}
      </article>)}
    </div>}
  </div>;
}
