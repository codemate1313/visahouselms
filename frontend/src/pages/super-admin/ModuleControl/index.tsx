import { type FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import type { ExamModule } from "@/api/types";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { moduleControlStrings as strings } from "./ModuleControl.strings";
import { ModuleFilterBar } from "./components/ModuleFilterBar";
import { ModuleTree } from "./components/ModuleTree";

export function ModuleControl() {
  const [modules, setModules] = useState<ExamModule[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<ExamModule[]>("/super-admin/modules", {
        params: { search: search || undefined, status: status || undefined },
      });
      setModules(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [status]);

  useEffect(() => {
    setItemCount(modules.length);
    return () => setItemCount(null);
  }, [modules.length, setItemCount]);

  function submit(event: FormEvent) {
    event.preventDefault();
    load();
  }

  const instructors = useMemo(() => {
    return Object.values(
      modules.reduce<Record<string, { id: number; name: string; modules: ExamModule[] }>>(
        (tree, module) => {
          const key = String(module.created_by_id);
          tree[key] ||= {
            id: module.created_by_id,
            name: module.created_by_name,
            modules: [],
          };
          tree[key].modules.push(module);
          return tree;
        },
        {}
      )
    );
  }, [modules]);

  return (
    <div className="module-control-page">
      <ModuleFilterBar search={search} onSearchChange={setSearch} status={status} onStatusChange={setStatus} onSubmit={submit} />

      {loading ? (
        <div className="course-loading-state">{strings.loading}</div>
      ) : !instructors.length ? (
        <div className="empty-state">
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
        </div>
      ) : (
        <ModuleTree instructors={instructors} />
      )}
    </div>
  );
}
