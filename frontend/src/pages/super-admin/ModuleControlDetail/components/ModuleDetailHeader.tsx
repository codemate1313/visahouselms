import { Badge } from "@/components/ui";
import { moduleControlDetailStrings as strings } from "../ModuleControlDetail.strings";
import { formatDate } from "../helpers";
import type { ManagedModule } from "../types";

interface ModuleDetailHeaderProps {
  module: ManagedModule;
}

export function ModuleDetailHeader({ module }: ModuleDetailHeaderProps) {
  return (
    <div className="page-header module-detail-header">
      <div>
        <span className="page-eyebrow">{strings.eyebrow}</span>
        <h1 className="module-detail-title">
          {module.title}
          {module.is_demo && <Badge tone="green">{strings.demoBadge}</Badge>}
        </h1>
        <p className="page-subtitle">
          {strings.createdBy} <strong>{module.created_by_name}</strong> on {formatDate(module.created_at)}
        </p>
      </div>
    </div>
  );
}
