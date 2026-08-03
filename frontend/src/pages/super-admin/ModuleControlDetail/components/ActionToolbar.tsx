import { moduleControlDetailStrings as strings } from "../ModuleControlDetail.strings";
import type { ManagedModule } from "../types";

interface ActionToolbarProps {
  module: ManagedModule;
  onToggleVisibility: () => void;
  onToggleDemo: () => void;
  onChangeStatus: (status: string) => void;
  onRemove: () => void;
}

export function ActionToolbar({ module, onToggleVisibility, onToggleDemo, onChangeStatus, onRemove }: ActionToolbarProps) {
  return (
    <div className="course-admin-actions-bar">
      <div className="action-buttons-group">
        <button type="button" className="btn-action-outline" onClick={onToggleVisibility}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {module.is_visible ? (
              <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </>
            ) : (
              <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
          {module.is_visible ? strings.hideFromSite : strings.showOnSite}
        </button>

        {/* Only a published, visible module can be a free demo - the server
            enforces the same rule. */}
        {module.status === "published" && module.is_visible && (
          <button
            type="button"
            className={module.is_demo ? "btn-action-primary" : "btn-action-outline"}
            onClick={onToggleDemo}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {module.is_demo ? strings.unmarkAsDemo : strings.markAsDemo}
          </button>
        )}

        {module.status !== "published" && (
          <button type="button" className="btn-action-primary" onClick={() => onChangeStatus("published")}>
            {strings.publishCourse}
          </button>
        )}

        {module.status === "published" && (
          <button type="button" className="btn-action-outline" onClick={() => onChangeStatus("archived")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect x="1" y="3" width="22" height="5" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
            {strings.archive}
          </button>
        )}

        <button type="button" className="btn-action-danger" onClick={onRemove}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          {strings.deleteCourse}
        </button>
      </div>
    </div>
  );
}
