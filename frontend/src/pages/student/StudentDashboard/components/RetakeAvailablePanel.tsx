import { Link } from "react-router-dom";
import type { StudentPlanModule } from "@/api/types";
import { Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { studentDashboardStrings as strings } from "../StudentDashboard.strings";

/**
 * Tests a reviewer has approved for a second sitting.
 *
 * An approved retake used to be visible only as a chip on My Tests, so a
 * candidate who never went looking simply let it expire. This sits directly
 * under the unfinished tests, and disappears the moment nothing is approved
 * and unused.
 */
export function RetakeAvailablePanel({ modules }: { modules: StudentPlanModule[] }) {
  const t = strings.retakes;
  const retakes = modules.filter((module) => module.retake_available && !module.is_violated);

  if (!retakes.length) return null;

  return (
    <section className="workspace-panel sd-retake-panel" aria-labelledby="sd-retake-title">
      <div className="panel-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2 id="sd-retake-title">{t.heading(retakes.length)}</h2>
          <p>{t.subtitle}</p>
        </div>
      </div>

      <ul className="sd-retake-list">
        {retakes.map((module) => {
          const moduleId = module.module_id ?? module.id;
          return (
            <li key={moduleId} className="sd-retake-row">
              <div className="sd-retake-copy">
                <strong>{module.title}</strong>
                <span>{t.rowNote}</span>
              </div>
              <Badge tone="green">{t.badge}</Badge>
              <Link className="ui-btn ui-btn-primary sd-retake-action" to="/student/my-courses">
                {t.action}
                <Icon name="arrowRight" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
