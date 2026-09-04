import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Checkbox, Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { useToastStore } from "@/store/toastStore";
import { trialConfigStrings as strings } from "../TrialConfig.strings";
import "../PlanForm/PlanForm.css";

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

function formatModuleType(type: string): string {
  if (!type) return "Course";
  return type
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getModuleTypeClass(type: string): string {
  const norm = (type || "").toLowerCase().replace(/_/g, "-");
  return `type-${norm}`;
}

/**
 * Chooses which published courses a student may sit for free before they
 * subscribe. Uses the modern card grid layout with master select-all and
 * select-by-module filtering matching PlanCoursePicker.
 */
export function DemoCoursePicker() {
  const t = strings.demo;
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [modules, setModules] = useState<DemoModuleOption[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<DemoModulesResponse>("/super-admin/trial-config/demo-modules")
      .then(({ data }) => {
        setModules(data.modules);
        setSelected(new Set(data.modules.filter((m) => m.is_demo).map((m) => m.id)));
      })
      .catch((err: unknown) => {
        const errMsg = extractErrorMessage(err, t.error);
        setError(errMsg);
      })
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

  function toggleAll() {
    if (selected.size === modules.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(modules.map((m) => m.id)));
    }
  }

  function selectBatch(ids: number[], shouldSelect: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (shouldSelect) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }

  // Group modules by module_type
  const { moduleTypes, modulesByType } = useMemo(() => {
    const byType = new Map<string, DemoModuleOption[]>();
    modules.forEach((mod) => {
      const type = mod.module_type || "other";
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(mod);
    });
    return {
      moduleTypes: Array.from(byType.keys()),
      modulesByType: byType,
    };
  }, [modules]);

  const handleToggleModuleType = (type: string) => {
    const typeMods = modulesByType.get(type) || [];
    if (typeMods.length === 0) return;

    const allTypeSelected = typeMods.every((m) => selected.has(m.id));
    const shouldSelect = !allTypeSelected;
    const ids = typeMods.map((m) => m.id);
    selectBatch(ids, shouldSelect);
  };

  const isAllSelected = modules.length > 0 && selected.size === modules.length;
  const isIndeterminate = selected.size > 0 && selected.size < modules.length;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const { data } = await apiClient.put<DemoModulesResponse>(
        "/super-admin/trial-config/demo-modules",
        { module_ids: [...selected] },
      );
      setModules(data.modules);
      setSelected(new Set(data.modules.filter((m) => m.is_demo).map((m) => m.id)));
      showSuccess(t.saved);
    } catch (err: unknown) {
      const errMsg = extractErrorMessage(err, t.error);
      setError(errMsg);
      showError(errMsg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <RouteLoadingState size={44} />;

  return (
    <section className="form-card wide" style={{ marginTop: 18 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>{t.heading}</h2>
      <p className="hint" style={{ marginTop: 0 }}>{t.description}</p>

      {!modules.length ? (
        <p className="empty-message">{t.empty}</p>
      ) : (
        <>
          <div className="plan-course-toolbar" style={{ marginBottom: 16 }}>
            {/* Top Row: Master select all checkbox with count */}
            <div className="plan-course-toolbar-top">
              <label className="plan-course-select-all-box" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={toggleAll}
                />
                <strong>Select all</strong>
                <span className="plan-course-count-badge">
                  {selected.size} of {modules.length} selected as demo
                </span>
              </label>
            </div>

            {/* Bottom Row: Select by Module Chips */}
            {moduleTypes.length > 0 && (
              <div className="plan-course-module-bar">
                <span className="plan-course-module-label">Select by module:</span>

                {moduleTypes.map((type) => {
                  const typeMods = modulesByType.get(type) || [];
                  const selectedInType = typeMods.filter((m) => selected.has(m.id)).length;
                  const isAllInType = selectedInType === typeMods.length && typeMods.length > 0;
                  const isPartialInType = selectedInType > 0 && selectedInType < typeMods.length;

                  return (
                    <button
                      key={type}
                      type="button"
                      className={`plan-course-module-chip ${
                        isAllInType ? "is-all-selected" : isPartialInType ? "is-partial-selected" : ""
                      }`}
                      onClick={() => handleToggleModuleType(type)}
                      title={`Click to ${isAllInType ? "deselect" : "select"} all ${formatModuleType(type)} courses`}
                    >
                      {isAllInType ? (
                        <Icon name="check" style={{ width: 13, height: 13 }} />
                      ) : (
                        <Icon name="plus" style={{ width: 12, height: 12 }} />
                      )}
                      <span>{formatModuleType(type)}</span>
                      <span className="plan-course-chip-count">
                        {selectedInType}/{typeMods.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cards Grid */}
          <div className="plan-courses-grid">
            {modules.map((module) => {
              const isChecked = selected.has(module.id);
              return (
                <div
                  key={module.id}
                  className={`plan-course-card ${isChecked ? "is-selected" : ""}`}
                  onClick={() => toggle(module.id)}
                  role="checkbox"
                  aria-checked={isChecked}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      toggle(module.id);
                    }
                  }}
                >
                  <div className="plan-course-card-checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isChecked} onChange={() => toggle(module.id)} />
                  </div>

                  <div className="plan-course-card-body">
                    <div className="plan-course-card-header">
                      <span
                        className={`plan-course-type-pill ${getModuleTypeClass(module.module_type)}`}
                      >
                        {formatModuleType(module.module_type)}
                      </span>
                    </div>

                    <strong className="plan-course-card-title">{module.title}</strong>

                    <span className="plan-course-card-meta">
                      {module.duration_minutes} minutes
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="error-text">{error}</p>}

      <div className="form-actions" style={{ marginTop: 20 }}>
        <Button
          type="button"
          variant="primary"
          loading={saving}
          disabled={saving || !modules.length}
          onClick={save}
        >
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </section>
  );
}
