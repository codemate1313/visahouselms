import type { DragEvent } from "react";
import { superAdminTestimonialsStrings as strings } from "../SuperAdminTestimonials.strings";
import type { DragReorderState, TestimonialAdminItem } from "../types";

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
            <div className="sat-drag-handle" title={strings.dragHandleTitle}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="8" cy="6" r="1.8" />
                <circle cx="16" cy="6" r="1.8" />
                <circle cx="8" cy="12" r="1.8" />
                <circle cx="16" cy="12" r="1.8" />
                <circle cx="8" cy="18" r="1.8" />
                <circle cx="16" cy="18" r="1.8" />
              </svg>
            </div>
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
              <button onClick={() => onEdit(item)} className="sat-action-btn edit" data-tooltip={strings.editTooltip}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button onClick={() => onDelete(item.id)} className="sat-action-btn delete" data-tooltip={strings.deleteTooltip}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
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
            <button onClick={() => onToggleActive(item)} className={`sat-toggle-btn ${item.is_active ? "active" : ""}`}>
              {item.is_active ? (
                <>
                  <span className="dot on"></span> {strings.publishedLabel}
                </>
              ) : (
                <>
                  <span className="dot off"></span> {strings.draftLabel}
                </>
              )}
            </button>
            <span className="sat-order-badge">
              {strings.orderPrefix}: {item.display_order}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
