import type { FormEvent } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { SearchableSelect } from "@/components/ui";
import { moduleControlDetailStrings as strings } from "../ModuleControlDetail.strings";
import type { Institute, ManagedModule } from "../types";

interface AssignInstitutePanelProps {
  module: ManagedModule;
  available: Institute[];
  selected: string;
  onSelectedChange: (value: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function AssignInstitutePanel({ module, available, selected, onSelectedChange, busy, onSubmit }: AssignInstitutePanelProps) {
  const t = strings.assignPanel;
  return (
    <CollapsiblePanel className="detail-card workspace-panel" title={t.title} description={t.description}>
      {module.status !== "published" ? (
        <div className="banner-warning-box">{t.publishFirst}</div>
      ) : (
        <form className="assign-institute-form" onSubmit={onSubmit}>
          <SearchableSelect
            options={available.map((inst) => ({ value: inst.id, label: inst.name }))}
            value={selected}
            onChange={(val) => onSelectedChange(String(val))}
            placeholder={t.selectPlaceholder}
            searchPlaceholder={t.searchPlaceholder}
            disabled={busy}
            emptyMessage={t.emptyMessage}
          />
          <button type="submit" className="grant-access-btn" disabled={busy || !selected}>
            {busy ? t.granting : t.grantAccess}
          </button>
        </form>
      )}
    </CollapsiblePanel>
  );
}
