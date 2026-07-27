import { RequiredMark, SearchableSelect } from "@/components/ui";
import { formatCurrencyAmount } from "@/utils/currency";
import { EMPTY_NEW_PLAN, planSummaryLine, type PlanMode, type PlanOption } from "../types";

interface AgreementPlanFieldsetProps {
  mode: PlanMode;
  onModeChange: (mode: PlanMode) => void;
  plans: PlanOption[];
  planId: string;
  onPlanChange: (planId: string) => void;
  newPlan: typeof EMPTY_NEW_PLAN;
  onNewPlanChange: (field: keyof typeof EMPTY_NEW_PLAN, value: string) => void;
  /** Courses picked on the Courses tab, shown so the new plan's bundle is
   *  visible without switching tabs. */
  selectedCourseCount: number;
}

export function AgreementPlanFieldset({
  mode,
  onModeChange,
  plans,
  planId,
  onPlanChange,
  newPlan,
  onNewPlanChange,
  selectedCourseCount,
}: AgreementPlanFieldsetProps) {
  const selected = plans.find((plan) => String(plan.id) === planId) || null;

  return (
    <div>
      <div className="form-section-header" style={{ marginTop: 32 }}>
        <h2 className="form-section-title">Institute Plan</h2>
        <p className="form-section-subtitle">
          Assign a plan from the institute catalogue, or create one here — a new plan is saved to Institute Plans and
          reusable for the next institute. Seats, validity and courses all come from the plan.
        </p>
      </div>

      <div className="plan-mode-switch">
        <label className={`plan-mode-option${mode === "existing" ? " is-selected" : ""}`}>
          <input type="radio" name="plan-mode" checked={mode === "existing"} onChange={() => onModeChange("existing")} />
          <span>
            <strong>Assign existing plan</strong>
            <small>Pick a plan already in the institute catalogue.</small>
          </span>
        </label>
        <label className={`plan-mode-option${mode === "new" ? " is-selected" : ""}`}>
          <input type="radio" name="plan-mode" checked={mode === "new"} onChange={() => onModeChange("new")} />
          <span>
            <strong>Create new plan</strong>
            <small>Saved to Institute Plans and assigned here.</small>
          </span>
        </label>
      </div>

      {mode === "existing" ? (
        <div className="plan-mode-body">
          <label htmlFor="plan_id">Institute plan<RequiredMark /></label>
          <SearchableSelect
            options={plans.map((plan) => ({
              value: plan.id,
              label: `${plan.name} — ${formatCurrencyAmount(plan.price, plan.currency)}`,
            }))}
            value={planId}
            onChange={(value) => onPlanChange(String(value))}
            searchPlaceholder="Search institute plans..."
            className="form-dropdown-select"
          />
          {plans.length === 0 && <p className="hint">No active institute plans yet — create one here instead.</p>}
          {selected && (
            <div className="plan-summary-strip">
              <strong>{formatCurrencyAmount(selected.price, selected.currency)}</strong>
              <span>{planSummaryLine(selected)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="plan-mode-body">
          <div className="form-grid-3col">
            <div>
              <label htmlFor="new_plan_name">Plan name<RequiredMark /></label>
              <input
                id="new_plan_name"
                value={newPlan.name}
                onChange={(event) => onNewPlanChange("name", event.target.value)}
                placeholder="e.g. Cambridge Academy — Annual"
              />
            </div>
            <div>
              <label htmlFor="new_plan_price">List price<RequiredMark /></label>
              <input
                id="new_plan_price"
                type="number"
                min="0"
                step="0.01"
                value={newPlan.price}
                onChange={(event) => onNewPlanChange("price", event.target.value)}
                placeholder="50000"
              />
            </div>
            <div>
              <label htmlFor="new_plan_currency">Currency</label>
              <input
                id="new_plan_currency"
                value={newPlan.currency}
                onChange={(event) => onNewPlanChange("currency", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new_plan_duration">Access duration (days)<RequiredMark /></label>
              <input
                id="new_plan_duration"
                type="number"
                min="1"
                value={newPlan.duration_days}
                onChange={(event) => onNewPlanChange("duration_days", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new_plan_students">Student seats<RequiredMark /></label>
              <input
                id="new_plan_students"
                type="number"
                min="0"
                value={newPlan.student_limit}
                onChange={(event) => onNewPlanChange("student_limit", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new_plan_staff">Instructor seats<RequiredMark /></label>
              <input
                id="new_plan_staff"
                type="number"
                min="0"
                value={newPlan.staff_limit}
                onChange={(event) => onNewPlanChange("staff_limit", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new_plan_tests">Test limit (0 = unlimited)</label>
              <input
                id="new_plan_tests"
                type="number"
                min="0"
                value={newPlan.test_limit}
                onChange={(event) => onNewPlanChange("test_limit", event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="new_plan_grace">Grace period (days)</label>
              <input
                id="new_plan_grace"
                type="number"
                min="0"
                value={newPlan.grace_days}
                onChange={(event) => onNewPlanChange("grace_days", event.target.value)}
              />
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label htmlFor="new_plan_description">Description</label>
            <textarea
              id="new_plan_description"
              rows={2}
              value={newPlan.description}
              onChange={(event) => onNewPlanChange("description", event.target.value)}
              placeholder="What this agreement includes..."
            />
          </div>
          <div className="plan-summary-strip">
            <strong>New plan</strong>
            <span>
              {planSummaryLine({
                student_limit: Number(newPlan.student_limit || 0),
                staff_limit: Number(newPlan.staff_limit || 0),
                duration_days: Number(newPlan.duration_days || 0),
                test_limit: Number(newPlan.test_limit || 0),
                module_count: selectedCourseCount,
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
