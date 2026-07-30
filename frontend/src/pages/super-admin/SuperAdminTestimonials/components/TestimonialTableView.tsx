import type { DragEvent } from "react";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
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
                  <RowActionMenu
                    items={[
                      <button key="status" type="button" onClick={() => onToggleActive(item)}>
                        <Icon name={item.is_active ? "toggleOff" : "toggleOn"} />
                        <span>{item.is_active ? strings.deactivateTooltip : strings.activateTooltip}</span>
                      </button>,
                      <button key="edit" type="button" onClick={() => onEdit(item)}>
                        <Icon name="edit" />
                        <span>{strings.editTooltip}</span>
                      </button>,
                      <button key="delete" type="button" className="danger" onClick={() => onDelete(item.id)}>
                        <Icon name="trash" />
                        <span>{strings.deleteTooltip}</span>
                      </button>,
                    ]}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
