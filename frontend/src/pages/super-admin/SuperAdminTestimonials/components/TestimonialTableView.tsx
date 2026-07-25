import type { DragEvent } from "react";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { superAdminTestimonialsStrings as strings } from "../SuperAdminTestimonials.strings";
import type { DragReorderState, TestimonialAdminItem } from "../types";

interface TestimonialTableViewProps {
  items: TestimonialAdminItem[];
  dragState: DragReorderState;
  onDragStart: (e: DragEvent, index: number) => void;
  onDragOver: (e: DragEvent, index: number) => void;
  onDragEnd: () => void;
  onDrop: (e: DragEvent, index: number) => void;
  onEdit: (item: TestimonialAdminItem) => void;
  onDelete: (id: number) => void;
  onToggleActive: (item: TestimonialAdminItem) => void;
}

export function TestimonialTableView({
  items,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onEdit,
  onDelete,
  onToggleActive,
}: TestimonialTableViewProps) {
  const t = strings.tableHeaders;
  return (
    <div className="sat-table-wrapper">
      <table className="sat-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>{t.name}</th>
            <th>{t.score}</th>
            <th>{t.quote}</th>
            <th>{t.status}</th>
            <th>{t.order}</th>
            <th>{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr
              key={item.id}
              draggable={true}
              onDragStart={(e) => onDragStart(e, index)}
              onDragOver={(e) => onDragOver(e, index)}
              onDragEnd={onDragEnd}
              onDrop={(e) => onDrop(e, index)}
              className={`${!item.is_active ? "inactive-row" : ""} ${dragState.draggedIndex === index ? "is-dragging" : ""} ${dragState.dragOverIndex === index ? "is-drag-over" : ""}`}
            >
              <td>
                <div className="sat-drag-handle" title={strings.dragRowHandleTitle}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="8" cy="6" r="1.8" />
                    <circle cx="16" cy="6" r="1.8" />
                    <circle cx="8" cy="12" r="1.8" />
                    <circle cx="16" cy="12" r="1.8" />
                    <circle cx="8" cy="18" r="1.8" />
                    <circle cx="16" cy="18" r="1.8" />
                  </svg>
                </div>
              </td>
              <td>
                <div className="sat-table-student">
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt="" className="sat-avatar-img" />
                  ) : (
                    <div className="sat-avatar-placeholder">{item.student_name.charAt(0).toUpperCase()}</div>
                  )}
                  <div>
                    <div className="sat-table-name">{item.student_name}</div>
                    <div className="sat-table-role">{item.student_role}</div>
                  </div>
                </div>
              </td>
              <td>
                <span className="sat-table-score">{item.target_score || "-"}</span>
              </td>
              <td>
                <div className="sat-table-quote" title={item.quote}>
                  "{item.quote.length > 60 ? item.quote.substring(0, 60) + "..." : item.quote}"
                </div>
              </td>
              <td>
                <span className={`sat-status-badge ${item.is_active ? "active" : "inactive"}`}>
                  <span className="dot"></span> {item.is_active ? strings.activeLabel : strings.draftLabel}
                </span>
              </td>
              <td>
                <span className="sat-order-badge">{item.display_order}</span>
              </td>
              <td>
                <div className="table-actions institute-row-actions">
                  <ToggleSwitch
                    checked={item.is_active}
                    onChange={() => onToggleActive(item)}
                    tooltip={item.is_active ? strings.deactivateTooltip : strings.activateTooltip}
                  />

                  <button onClick={() => onEdit(item)} className="action-btn-icon action-edit" data-tooltip={strings.editTooltip}>
                    <svg className="table-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>

                  <button onClick={() => onDelete(item.id)} className="action-btn-icon danger action-delete" data-tooltip={strings.deleteTooltip}>
                    <svg className="table-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
