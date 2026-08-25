import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Button, Modal, RequiredMark, SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { useLoginSliderStore } from "@/store/loginSliderStore";
import { useToastStore } from "@/store/toastStore";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

export function LoginSliderTab() {
  const { slides, updateSlide, addSlide, removeSlide, resetSlides } = useLoginSliderStore();
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  // Dialog State for Adding a New Slide
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newBadge, setNewBadge] = useState("Language CERT PLATFORM");

  // File Upload State inside Dialog
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dialogFileInputRef = useRef<HTMLInputElement>(null);

  // Per-slide image replacement upload state
  const [updatingSlideId, setUpdatingSlideId] = useState<string | null>(null);
  const slideFileInputRef = useRef<HTMLInputElement>(null);
  const targetSlideIdRef = useRef<string | null>(null);

  const t = strings.slider;

  // Handle file selection in Add Dialog
  async function handleDialogFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file (PNG, JPG, WebP, GIF).");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setSelectedFile(file);
    setFilePreviewUrl(localPreview);
    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<{ url: string }>("/super-admin/upload-image", formData);
      setNewUrl(data.url);
    } catch (err: unknown) {
      setUploadError(extractErrorMessage(err, "Failed to upload image. You can also provide a direct URL."));
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void handleDialogFileSelect(file);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleDialogFileSelect(file);
    }
  }

  function resetDialogForm() {
    setNewUrl("");
    setNewTitle("");
    setNewSubtitle("");
    setNewBadge("Language CERT PLATFORM");
    setSelectedFile(null);
    setFilePreviewUrl("");
    setUploadError(null);
    setUploading(false);
    setImageMode("upload");
    if (dialogFileInputRef.current) dialogFileInputRef.current.value = "";
  }

  function handleOpenAddModal() {
    resetDialogForm();
    setIsAddModalOpen(true);
  }

  function handleAddSlideSubmit(e: FormEvent) {
    e.preventDefault();
    const finalImageUrl = (imageMode === "upload" ? newUrl || filePreviewUrl : newUrl).trim();
    if (!finalImageUrl) {
      showError("Please upload an image or enter an Image URL.", "Image Required");
      return;
    }
    if (!newTitle.trim()) {
      showError("Please enter a slide title.", "Title Required");
      return;
    }

    addSlide({
      imageUrl: finalImageUrl,
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || t.defaultSubtitle,
      badge: newBadge.trim() || t.defaultBadge,
    });

    setIsAddModalOpen(false);
    resetDialogForm();
    showSuccess(t.addedToastMessage, t.addedToastTitle);
  }

  // Handle uploading and replacing an existing slide's image directly
  function triggerSlideImageUpload(slideId: string) {
    targetSlideIdRef.current = slideId;
    slideFileInputRef.current?.click();
  }

  async function handleSlideFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slideId = targetSlideIdRef.current;
    if (!file || !slideId) return;

    if (!file.type.startsWith("image/")) {
      showError("Please select a valid image file.", "Invalid Format");
      return;
    }

    setUpdatingSlideId(slideId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<{ url: string }>("/super-admin/upload-image", formData);
      updateSlide(slideId, { imageUrl: data.url });
      showSuccess("Slide image updated successfully!", "Image Uploaded");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to upload slide image."), "Upload Failed");
    } finally {
      setUpdatingSlideId(null);
      targetSlideIdRef.current = null;
      if (slideFileInputRef.current) slideFileInputRef.current.value = "";
    }
  }

  return (
    <CollapsiblePanel className="form-card wide developer-panel-card" title={t.title} description={t.description}>
      {/* Hidden file input for changing existing slide images */}
      <input
        type="file"
        ref={slideFileInputRef}
        onChange={handleSlideFileChange}
        accept="image/*"
        style={{ display: "none" }}
      />

      {/* Header Controls & Add Button */}
      <div className="login-slider-toolbar">
        <div className="login-slider-toolbar-left">
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
            {t.currentSlidesTitle}
            <span className="count-chip">{slides.length}</span>
          </h3>
          <p className="hint" style={{ margin: 0, fontSize: 12 }}>
            {t.currentSlidesDescription}
          </p>
        </div>

        <div className="login-slider-toolbar-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              resetSlides();
              showSuccess(t.resetToastMessage, t.resetToastTitle);
            }}
          >
            <Icon name="restore" />
            {t.resetLabel}
          </Button>

          <Button type="button" variant="primary" onClick={handleOpenAddModal}>
            <Icon name="plus" />
            {t.addLabel}
          </Button>
        </div>
      </div>

      {/* Current Slides List */}
      <div className="login-slider-cards-list">
        {slides.map((slide) => (
          <div key={slide.id} className="slide-item-card">
            {/* Slide Image Preview & Click-to-Upload Overlay */}
            <div className="slide-image-col">
              <div
                className="slide-image-thumb-wrap"
                onClick={() => triggerSlideImageUpload(slide.id)}
                title="Click to choose a new image file from your computer"
              >
                <img src={slide.imageUrl} alt={slide.title} className="slide-image-thumb" />
                <div className="slide-image-thumb-overlay">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span>{updatingSlideId === slide.id ? "Uploading..." : "Change Image"}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="slide-change-img-btn"
                onClick={() => triggerSlideImageUpload(slide.id)}
                disabled={updatingSlideId === slide.id}
              >
                <Icon name="edit" />
                {updatingSlideId === slide.id ? "Uploading..." : "Upload Image"}
              </Button>
            </div>

            {/* Editable Fields Line by Line with Titles */}
            <div className="slide-card-fields">
              <div className="slide-field-group">
                <label className="slide-field-label">{t.badgeLabel}</label>
                <input
                  type="text"
                  placeholder={t.badgePlaceholder}
                  value={slide.badge}
                  onChange={(e) => updateSlide(slide.id, { badge: e.target.value })}
                  className="slide-badge-input"
                />
              </div>

              <div className="slide-field-group">
                <label className="slide-field-label">{t.titleLabel}</label>
                <input
                  type="text"
                  placeholder={t.titlePlaceholder}
                  value={slide.title}
                  onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
                  className="slide-title-input"
                />
              </div>

              <div className="slide-field-group">
                <label className="slide-field-label">{t.subtitleLabel}</label>
                <input
                  type="text"
                  placeholder={t.subtitlePlaceholder}
                  value={slide.subtitle}
                  onChange={(e) => updateSlide(slide.id, { subtitle: e.target.value })}
                  className="slide-subtitle-input"
                />
              </div>

              <div className="slide-field-group">
                <label className="slide-field-label">{t.imageUrlLabel}</label>
                <input
                  type="text"
                  placeholder={t.imageUrlPlaceholder}
                  value={slide.imageUrl}
                  onChange={(e) => updateSlide(slide.id, { imageUrl: e.target.value })}
                  className="slide-url-input"
                />
              </div>
            </div>

            {/* Remove Action */}
            {slides.length > 1 && (
              <div className="slide-card-actions">
                <button
                  type="button"
                  className="slide-remove-btn"
                  onClick={() => removeSlide(slide.id)}
                  title="Remove this slide"
                >
                  {t.removeLabel}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Custom Educational Slide Modal Dialog */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        size="md"
        title={t.addSectionTitle}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={uploading || (!newUrl && !filePreviewUrl) || !newTitle.trim()}
              onClick={(e) => handleAddSlideSubmit(e as unknown as FormEvent)}
            >
              <Icon name="plus" />
              {t.addLabel}
            </Button>
          </>
        }
      >
        <form onSubmit={handleAddSlideSubmit} className="add-slide-dialog-form">
          <p className="hint" style={{ margin: "0 0 12px 0", fontSize: 13 }}>
            {t.addSectionDescription}
          </p>

          {/* Image Source Segmented Switcher */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 6 }}>
              Slide Image <RequiredMark />
            </label>

            <SegmentedControl
              ariaLabel="Image source mode"
              onChange={(val) => setImageMode(val as "upload" | "url")}
              options={[
                { label: "Upload Image File", value: "upload" },
                { label: "Enter Image URL", value: "url" },
              ]}
              size="sm"
              value={imageMode}
            />
          </div>

          {/* File Upload Mode */}
          {imageMode === "upload" && (
            <div>
              <input
                type="file"
                ref={dialogFileInputRef}
                onChange={handleFileInputChange}
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: "none" }}
              />

              {filePreviewUrl ? (
                <div className="slide-preview-card">
                  <img src={filePreviewUrl} alt="Slide Preview" />
                  {selectedFile && (
                    <div style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      background: "rgba(15, 23, 42, 0.75)",
                      color: "#ffffff",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      backdropFilter: "blur(4px)",
                    }}>
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </div>
                  )}
                  <div className="slide-preview-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => dialogFileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Icon name="edit" />
                      {uploading ? "Uploading..." : "Change Image"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setFilePreviewUrl("");
                        setNewUrl("");
                      }}
                    >
                      <Icon name="cross" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={`slide-upload-dropzone ${isDragging ? "is-dragging" : ""}`}
                  onClick={() => dialogFileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <svg
                    className="slide-upload-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <div>
                    <strong style={{ fontSize: 13.5, display: "block", color: "var(--text)" }}>
                      {uploading ? "Uploading image..." : "Click to browse or drag & drop image"}
                    </strong>
                    <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                      Supports PNG, JPG, WebP, GIF (Max 10MB)
                    </span>
                  </div>
                </div>
              )}

              {uploadError && <p className="error-text" style={{ marginTop: 6, fontSize: 12 }}>{uploadError}</p>}
            </div>
          )}

          {/* Direct URL Mode */}
          {imageMode === "url" && (
            <div>
              <input
                type="url"
                placeholder={t.imageUrlInputPlaceholder}
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                required
              />
              {newUrl && (
                <div className="slide-preview-card" style={{ marginTop: 10, height: 140 }}>
                  <img src={newUrl} alt="Slide URL Preview" />
                </div>
              )}
            </div>
          )}

          {/* Badge Text */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
              {t.badgeLabel}
            </label>
            <input
              type="text"
              placeholder={t.badgeInputPlaceholder}
              value={newBadge}
              onChange={(e) => setNewBadge(e.target.value)}
            />
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
              {t.titleLabel} <RequiredMark />
            </label>
            <input
              type="text"
              placeholder={t.titleInputPlaceholder}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
          </div>

          {/* Subtitle */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
              {t.subtitleLabel}
            </label>
            <textarea
              placeholder={t.subtitleInputPlaceholder}
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
              rows={2}
              style={{ width: "100%", resize: "vertical", fontSize: 13 }}
            />
          </div>
        </form>
      </Modal>
    </CollapsiblePanel>
  );
}
