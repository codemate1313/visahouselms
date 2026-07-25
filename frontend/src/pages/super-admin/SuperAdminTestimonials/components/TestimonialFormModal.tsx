import type { FormEvent } from "react";
import { superAdminTestimonialsStrings as strings } from "../SuperAdminTestimonials.strings";
import type { TestimonialAdminItem } from "../types";

interface TestimonialFormModalProps {
  editingItem: Partial<TestimonialAdminItem>;
  onChange: (item: Partial<TestimonialAdminItem>) => void;
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent) => void;
}

export function TestimonialFormModal({ editingItem, onChange, saving, onClose, onSave }: TestimonialFormModalProps) {
  const t = strings.modal;
  return (
    <div className="sat-modal-backdrop">
      <div className="sat-modal">
        <div className="sat-modal-header">
          <h2>{editingItem.id ? t.editTitle : t.addTitle}</h2>
          <button type="button" className="sat-modal-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="sat-modal-body">
          <form id="testimonial-form" onSubmit={onSave}>
            <div className="sat-form-grid">
              <div className="sat-form-group">
                <label>{t.nameLabel}</label>
                <input
                  type="text"
                  required
                  value={editingItem.student_name || ""}
                  onChange={(e) => onChange({ ...editingItem, student_name: e.target.value })}
                  className="sat-input"
                  placeholder={t.namePlaceholder}
                />
              </div>
              <div className="sat-form-group">
                <label>{t.targetScoreLabel}</label>
                <input
                  type="text"
                  value={editingItem.target_score || ""}
                  onChange={(e) => onChange({ ...editingItem, target_score: e.target.value })}
                  className="sat-input"
                  placeholder={t.targetScorePlaceholder}
                />
              </div>
              <div className="sat-form-group full-width">
                <label>{t.roleLabel}</label>
                <input
                  type="text"
                  value={editingItem.student_role || ""}
                  onChange={(e) => onChange({ ...editingItem, student_role: e.target.value })}
                  className="sat-input"
                  placeholder={t.rolePlaceholder}
                />
              </div>
              <div className="sat-form-group">
                <label>{t.avatarLabel}</label>
                <input
                  type="url"
                  value={editingItem.avatar_url || ""}
                  onChange={(e) => onChange({ ...editingItem, avatar_url: e.target.value })}
                  className="sat-input"
                  placeholder={t.avatarPlaceholder}
                />
              </div>
              <div className="sat-form-group">
                <label>{t.ratingLabel}</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={editingItem.rating || 5}
                  onChange={(e) => onChange({ ...editingItem, rating: parseInt(e.target.value) })}
                  className="sat-input"
                />
              </div>
              <div className="sat-form-group full-width">
                <label>{t.quoteLabel}</label>
                <textarea
                  required
                  rows={4}
                  value={editingItem.quote || ""}
                  onChange={(e) => onChange({ ...editingItem, quote: e.target.value })}
                  className="sat-input sat-textarea"
                  placeholder={t.quotePlaceholder}
                ></textarea>
              </div>
              <div className="sat-form-group">
                <label>{t.displayOrderLabel}</label>
                <input
                  type="number"
                  value={editingItem.display_order || 0}
                  onChange={(e) => onChange({ ...editingItem, display_order: parseInt(e.target.value) })}
                  className="sat-input"
                />
              </div>
              <div className="sat-form-group sat-checkbox-group">
                <label className="sat-checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingItem.is_active || false}
                    onChange={(e) => onChange({ ...editingItem, is_active: e.target.checked })}
                  />
                  <span>{t.publishImmediatelyLabel}</span>
                </label>
              </div>
            </div>
          </form>
        </div>
        <div className="sat-modal-footer">
          <button type="button" onClick={onClose} className="sat-btn sat-btn-secondary">
            {t.cancel}
          </button>
          <button type="submit" form="testimonial-form" disabled={saving} className="sat-btn sat-btn-primary">
            {saving ? t.saveBusy : t.saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
