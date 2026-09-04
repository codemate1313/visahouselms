import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { confirmDelete } from "@/components/confirmDialog";
import type { ExamModule, ModuleBlueprint } from "@/api/types";
import { PageHeader } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: rows }, { data: templates }] = await Promise.all([
        apiClient.get<ExamModule[]>("/instructor/modules", {
          params: {
            search: search.trim() || undefined,
            module_type: type || undefined,
            status: status || undefined,
          },
        }),
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
  }, [search, type, status]);

  // Debounced auto-search: live filtering without requiring a manual Search button
  useEffect(() => {
    const timer = setTimeout(load, search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

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
      <PageHeader title={strings.title} subtitle={strings.subtitle} />

      <ModuleTypeGrid blueprints={blueprints} />

      <div className="section-heading module-list-heading">
        <div>
          <h2>{strings.yourModules.title}</h2>
          <p>{strings.yourModules.description}</p>
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
      />
      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <RouteLoadingState />
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
