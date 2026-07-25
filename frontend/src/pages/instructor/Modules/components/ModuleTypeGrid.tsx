import { Link } from "react-router-dom";
import type { ModuleBlueprint } from "@/api/types";
import { modulesStrings as strings } from "../Modules.strings";

interface ModuleTypeGridProps {
  blueprints: ModuleBlueprint[];
}

export function ModuleTypeGrid({ blueprints }: ModuleTypeGridProps) {
  return (
    <section className="module-type-grid" aria-label={strings.createAriaLabel}>
      {blueprints.map((blueprint) => (
        <Link
          className={`module-type-card module-type-${blueprint.module_type}`}
          to={`/super-admin/instructor/modules/new/${blueprint.module_type}`}
          key={blueprint.module_type}
        >
          <span className="module-type-icon" aria-hidden="true">{strings.typeIcons[blueprint.module_type]}</span>
          <div>
            <h2>{blueprint.label}</h2>
            <p>{strings.typeDetail[blueprint.module_type]}</p>
          </div>
          <span className="module-create-label">{strings.createCta}</span>
        </Link>
      ))}
    </section>
  );
}
