import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge, Checkbox } from "@/components/ui";
import { trialConfigStrings as strings } from "../TrialConfig.strings";

interface DemoModuleOption {
  id: number;
  title: string;
  module_type: string;
  duration_minutes: number;
  is_demo: boolean;
}

interface DemoModulesResponse {
  course_limit: number;
  modules: DemoModuleOption[];
}

/**
 * Chooses which published courses a student may sit for free before they
 * subscribe. The server offers only the first `course_limit` of them, so the
 * ones past that cap are marked here rather than silently ignored.
 */
export function DemoCoursePicker({ courseLimit }: { courseLimit: number }) {
  const t = strings.demo;
  const [modules, setModules] = useState<DemoModuleOption[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<DemoModulesResponse>("/super-admin/trial-config/demo-modules")
      .then(({ data }) => {
        setModules(data.modules);
        setSelected(new Set(data.modules.filter((m) => m.is_demo).map((m) => m.id)));
      })
      .catch((err: unknown) => setError(extractErrorMessage(err, t.error)))
      .finally(() => setLoading(false));
  }, [t.error]);

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const { data } = await apiClient.put<DemoModulesResponse>(
        "/super-admin/trial-config/demo-modules",
        { module_ids: [...selected] },
      );
      setModules(data.modules);
      setSelected(new Set(data.modules.filter((m) => m.is_demo).map((m) => m.id)));
      setNotice(t.saved);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.error));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="hint">{strings.loading}</p>;

  // Offered set mirrors the server: stable order, capped by the limit.
  const offeredIds = modules.filter((m) => selected.has(m.id)).slice(0, Math.max(0, courseLimit)).map((m) => m.id);

  return (
    <section className="form-card wide" style={{ marginTop: 18 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{t.heading}</h2>
      <p className="hint" style={{ marginTop: 0 }}>{t.description}</p>

      {!modules.length ? (
        <p className="empty-message">{t.empty}</p>
      ) : (
        <>
          <p className="hint">{t.offered(selected.size, Math.max(0, courseLimit))}</p>
          <div className="demo-course-list">
            {modules.map((module) => {
              const isSelected = selected.has(module.id);
              const beyondLimit = isSelected && !offeredIds.includes(module.id);
              return (
                <label className="plan-course-option" key={module.id}>
                  <Checkbox checked={isSelected} onChange={() => toggle(module.id)} />
                  <span>
                    <strong>{module.title}</strong>
                    <small>
                      {module.module_type.replaceAll("_", " ")} · {module.duration_minutes} minutes
                    </small>
                  </span>
                  {beyondLimit && <Badge tone="amber">{t.beyondLimit}</Badge>}
                </label>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      <div className="form-actions">
        <button type="button" disabled={saving || !modules.length} onClick={save}>
          {saving ? t.saving : t.save}
        </button>
      </div>
    </section>
  );
}
