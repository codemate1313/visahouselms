import { Link } from "react-router-dom";
import type { ModuleBlueprint } from "@/api/types";
import { modulesStrings as strings } from "../Modules.strings";
import { Icon } from "@/components/icons";

interface ModuleTypeGridProps {
  blueprints: ModuleBlueprint[];
}

export function ModuleTypeGrid({ blueprints }: ModuleTypeGridProps) {
  return (
    <section className="module-type-grid" aria-label={strings.createAriaLabel}>
      {blueprints.map((blueprint) => {
        const details = strings.typeDetail[blueprint.module_type].split(" · ");
        return (
          <Link
            className={`module-type-card module-type-${blueprint.module_type}`}
            to={`/super-admin/instructor/modules/new/${blueprint.module_type}`}
            key={blueprint.module_type}
          >
            <div className="module-type-card-header">
              <span className="module-type-icon" aria-hidden="true">
                {strings.typeIcons[blueprint.module_type]}
              </span>
              <h2>{blueprint.label}</h2>
            </div>
            
            <div className="module-type-card-body">
              <div className="module-type-meta">
                {details.map((detail, idx) => (
                  <span key={idx} className="module-type-meta-item">
                    {detail.trim()}
                  </span>
                ))}
              </div>
            </div>

            <div className="module-type-card-footer">
              <span className="module-create-label">
                {strings.createCta} <Icon name="arrowRight" />
              </span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}
