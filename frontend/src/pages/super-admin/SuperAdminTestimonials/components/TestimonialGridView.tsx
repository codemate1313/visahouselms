import type { DragEvent } from "react";
import { superAdminTestimonialsStrings as strings } from "../SuperAdminTestimonials.strings";
import type { DragReorderState, TestimonialAdminItem } from "../types";
import { Button } from "@/components/ui/Button/Button";
import { IconButton } from "@/components/ui/IconButton/IconButton";

interface TestimonialGridViewProps {
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

export function TestimonialGridView({
  items,
  dragState,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onEdit,
  onDelete,
  onToggleActive,
}: TestimonialGridViewProps) {
  return (
    <div className="sat-grid-view">
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable={true}
          onDragStart={(e) => onDragStart(e, index)}
          onDragOver={(e) => onDragOver(e, index)}
          onDragEnd={onDragEnd}
          onDrop={(e) => onDrop(e, index)}
          className={`sat-card ${!item.is_active ? "inactive" : ""} ${dragState.draggedIndex === index ? "is-dragging" : ""} ${dragState.dragOverIndex === index ? "is-drag-over" : ""}`}
        >
          <div className="sat-card-header">
            <img
              src={item.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(item.student_name)}
              alt={item.student_name}
              className="sat-card-avatar"
            />
            <div className="sat-card-meta">
              <h3 className="sat-card-name">{item.student_name}</h3>
              <div className="sat-card-role">{item.student_role}</div>
            </div>
            <div className="sat-card-actions">
              <IconButton
                onClick={() => onEdit(item)}
                className="sat-action-btn edit"
                label={strings.editTooltip}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                }
              />
              <IconButton
                onClick={() => onDelete(item.id)}
                className="sat-action-btn delete"
                label={strings.deleteTooltip}
                variant="danger"
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                }
              />
            </div>
          </div>
          <div className="sat-card-body">
            <div className="sat-card-rating">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={i < item.rating ? "var(--amber-500)" : "none"}
                  stroke={i < item.rating ? "var(--amber-500)" : "var(--slate-300)"}
                  strokeWidth="2"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
              {item.target_score && <span className="sat-card-score">{item.target_score}</span>}
            </div>
            <p className="sat-card-quote">"{item.quote}"</p>
          </div>
          <div className="sat-card-footer">
            <Button onClick={() => onToggleActive(item)} variant="ghost" className={`sat-toggle-btn ${item.is_active ? "active" : ""}`}>
              {item.is_active ? (
                <>
                  <span className="dot on"></span> {strings.publishedLabel}
                </>
              ) : (
                <>
                  <span className="dot off"></span> {strings.draftLabel}
                </>
              )}
            </Button>
            <span className="sat-order-badge">
              {strings.orderPrefix}: {item.display_order}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
