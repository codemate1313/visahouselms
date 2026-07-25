import type { StudentPlanCatalogItem } from "@/api/types";
import { courseCatalogStrings as strings } from "../CourseCatalog.strings";

interface PlanGridProps {
  plans: StudentPlanCatalogItem[];
  onGoToCourse: () => void;
  onChoosePlan: (plan: StudentPlanCatalogItem) => void;
}

export function PlanGrid({ plans, onGoToCourse, onChoosePlan }: PlanGridProps) {
  return (
    <div className="module-list-grid">
      {plans.map((plan) => (
        <div className="module-record-card" key={plan.id}>
          <div className="section-chip">{strings.durationSuffix(plan.duration_days)}</div>
          <h2>{plan.name}</h2>
          <p>{plan.description || strings.defaultDescription}</p>
          <div className="course-meta">
            <span>{strings.testsCount(plan.module_count)}</span>
            <span>
              {plan.currency} {Number(plan.price).toLocaleString("en-IN")}
            </span>
          </div>
          {plan.entitled ? (
            <button onClick={onGoToCourse}>{strings.goToCourse}</button>
          ) : (
            <button onClick={() => onChoosePlan(plan)}>{strings.choosePlan}</button>
          )}
        </div>
      ))}
    </div>
  );
}
