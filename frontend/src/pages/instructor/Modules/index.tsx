import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { confirmDelete } from "@/components/confirmDialog";
import type { ExamModule, ModuleBlueprint } from "@/api/types";
import { modulesStrings as strings } from "./Modules.strings";
import { ModuleTypeGrid } from "./components/ModuleTypeGrid";
import { ModuleFilterBar } from "./components/ModuleFilterBar";
import { ModuleList } from "./components/ModuleList";

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
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type, status]);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  async function deleteDraft(moduleId: number, title: string) {
    if (!await confirmDelete(strings.confirmDelete.message(title), strings.confirmDelete.title)) return;
    try {
      await apiClient.delete(`/instructor/modules/${moduleId}`);
      await load();
    } catch {
      setError(strings.errors.delete);
    }
  }

  return (
    <div className="module-catalog">
      <div className="page-header">
        <div>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>

      <ModuleTypeGrid blueprints={blueprints} />

      <div className="section-heading module-list-heading">
        <div>
          <h2>{strings.yourCourses.title}</h2>
          <p>{strings.yourCourses.description}</p>
        </div>
      </div>
      <ModuleFilterBar
        blueprints={blueprints}
        search={search}
        onSearchChange={setSearch}
        type={type}
        onTypeChange={setType}
        status={status}
        onStatusChange={setStatus}
        onSubmit={submit}
      />
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p>{strings.loading}</p>
      ) : !modules.length ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
        </div>
      ) : (
        <ModuleList modules={modules} onDeleteDraft={deleteDraft} />
      )}
    </div>
  );
}
