import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, Checkbox, RequiredMark } from "@/components/ui";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    onChange({ ...editingItem, avatar_url: localUrl });
    setUploadingAvatar(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<{ url: string; avatar_path?: string }>("/super-admin/upload-avatar", formData);
      onChange({ ...editingItem, avatar_url: data.url });
    } catch (err: unknown) {
      setUploadError(extractErrorMessage(err, "Failed to upload avatar image"));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
                <label>{t.nameLabel}<RequiredMark /></label>
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

              {/* Avatar File Selector / URL Input */}
              <div className="sat-form-group full-width">
                <label>{t.avatarLabel}</label>
                <div className="sat-avatar-picker-container">
                  <div className="sat-avatar-preview-box">
                    {editingItem.avatar_url ? (
                      <img
                        src={editingItem.avatar_url}
                        alt={editingItem.student_name || "Avatar"}
                        className="sat-avatar-preview-img"
                      />
                    ) : (
                      <div className="sat-avatar-placeholder">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                    )}
                    {uploadingAvatar && (
                      <div className="sat-avatar-loading-overlay">
                        <div className="sat-spinner-sm" />
                      </div>
                    )}
                  </div>

                  <div className="sat-avatar-controls">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/png,image/jpeg,image/webp,image/jpg"
                      style={{ display: "none" }}
                    />
                    <div className="sat-avatar-actions-row">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAvatar}
                        className="sat-btn-choose"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        {uploadingAvatar ? "Uploading..." : "Choose from files"}
                      </button>

                      {editingItem.avatar_url && (
                        <button
                          type="button"
                          onClick={() => onChange({ ...editingItem, avatar_url: "" })}
                          className="sat-btn-clear"
                          title="Remove image"
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={editingItem.avatar_url || ""}
                      onChange={(e) => onChange({ ...editingItem, avatar_url: e.target.value })}
                      className="sat-input sat-input-url"
                      placeholder="Or paste image URL (https://...)"
                    />
                  </div>
                </div>
                {uploadError && <span className="sat-upload-error">{uploadError}</span>}
              </div>

              <div className="sat-form-group">
                <label>{t.ratingLabel}</label>
                <select
                  value={editingItem.rating ?? 5}
                  onChange={(e) => onChange({ ...editingItem, rating: parseInt(e.target.value, 10) })}
                  className="sat-input sat-select"
                >
                  <option value={5}>5 - Excellent (★★★★★)</option>
                  <option value={4}>4 - Very Good (★★★★☆)</option>
                  <option value={3}>3 - Good (★★★☆☆)</option>
                  <option value={2}>2 - Fair (★★☆☆☆)</option>
                  <option value={1}>1 - Poor (★☆☆☆☆)</option>
                </select>
              </div>
              <div className="sat-form-group">
                <label>{t.displayOrderLabel}</label>
                <input
                  type="number"
                  value={editingItem.display_order || 0}
                  onChange={(e) => onChange({ ...editingItem, display_order: parseInt(e.target.value) || 0 })}
                  className="sat-input"
                />
              </div>
              <div className="sat-form-group full-width">
                <label>{t.quoteLabel}<RequiredMark /></label>
                <textarea
                  required
                  rows={4}
                  value={editingItem.quote || ""}
                  onChange={(e) => onChange({ ...editingItem, quote: e.target.value })}
                  className="sat-input sat-textarea"
                  placeholder={t.quotePlaceholder}
                ></textarea>
              </div>
              <div className="sat-form-group sat-checkbox-group">
                <label className="sat-checkbox-label">
                  <Checkbox
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
          <Button type="button" onClick={onClose} variant="secondary" size="md">
            {t.cancel}
          </Button>
          <Button type="submit" form="testimonial-form" loading={saving} variant="primary" size="md">
            {saving ? t.saveBusy : t.saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
