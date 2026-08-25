import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { Button, Modal, RequiredMark, SegmentedControl } from "@/components/ui";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { Icon } from "@/components/icons";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import {
  createHeroSlide,
  deleteHeroSlide,
  emptyHeroSlideDraft,
  fetchAdminHeroSlides,
  reorderHeroSlides,
  resetHeroSlides,
  updateHeroSlide,
  type HeroLocation,
  type HeroSlideDraft,
  type HeroSlideRecord,
} from "@/api/heroSlides";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

const LOCATION_OPTIONS = [
  { label: "Home Page Hero", value: "home" },
  { label: "Login & Register Hero", value: "login" },
];

/** Fields the backend accepts on create/update, taken off an edited record. */
function toDraft(slide: HeroSlideRecord): HeroSlideDraft {
  const { id: _id, created_at: _created, updated_at: _updated, ...draft } = slide;
  return draft;
}

export function HeroSliderTab() {
  const t = strings.slider;
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  const [location, setLocation] = useState<HeroLocation>("home");
  const isHome = location === "home";

  // `slides` holds the edited drafts; `savedRef` holds the last server copy of
  // each, which is what "unsaved changes" and Revert compare against.
  const [slides, setSlides] = useState<HeroSlideRecord[]>([]);
  const savedRef = useRef<Record<number, HeroSlideRecord>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  // Add-slide dialog
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [newSlide, setNewSlide] = useState<HeroSlideDraft>(() => emptyHeroSlideDraft("home"));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dialogFileInputRef = useRef<HTMLInputElement>(null);

  // Per-slide image replacement
  const [updatingSlideId, setUpdatingSlideId] = useState<number | null>(null);
  const slideFileInputRef = useRef<HTMLInputElement>(null);
  const targetSlideIdRef = useRef<number | null>(null);

  const applyServerSlides = useCallback((rows: HeroSlideRecord[]) => {
    savedRef.current = Object.fromEntries(rows.map((row) => [row.id, row]));
    setSlides(rows);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      applyServerSlides(await fetchAdminHeroSlides(location));
    } catch (err: unknown) {
      setLoadError(extractErrorMessage(err, t.loadError));
    } finally {
      setLoading(false);
    }
  }, [applyServerSlides, location, t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

  function isDirty(slide: HeroSlideRecord) {
    const saved = savedRef.current[slide.id];
    return !saved || !isEqual(toDraft(saved), toDraft(slide));
  }

  const dirtyCount = slides.filter(isDirty).length;

  function editSlide(id: number, patch: Partial<HeroSlideRecord>) {
    setSlides((prev) => prev.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)));
  }

  async function saveSlide(slide: HeroSlideRecord) {
    if (!slide.title.trim()) {
      showError("A slide needs a title before it can be saved.", "Title Required");
      return false;
    }
    if (!slide.image_url.trim()) {
      showError("A slide needs an image before it can be saved.", "Image Required");
      return false;
    }
    setSavingId(slide.id);
    try {
      const updated = await updateHeroSlide(slide.id, toDraft(slide));
      savedRef.current[updated.id] = updated;
      setSlides((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      return true;
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to save this slide."), "Save Failed");
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveSlide(slide: HeroSlideRecord) {
    if (await saveSlide(slide)) showSuccess("Slide saved and live for every visitor.", "Slide Saved");
  }

  async function handleSaveAll() {
    const dirty = slides.filter(isDirty);
    if (dirty.length === 0) {
      showSuccess("Everything is already saved.", "No Changes");
      return;
    }
    setBusy(true);
    let saved = 0;
    for (const slide of dirty) {
      if (await saveSlide(slide)) saved += 1;
    }
    setBusy(false);
    if (saved > 0) showSuccess(`${saved} slide${saved === 1 ? "" : "s"} saved and live.`, "Slides Saved");
  }

  function handleRevert(slide: HeroSlideRecord) {
    const saved = savedRef.current[slide.id];
    if (saved) setSlides((prev) => prev.map((row) => (row.id === slide.id ? saved : row)));
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = next.map((slide, i) => ({ ...slide, display_order: i }));
    setSlides(ordered);
    setBusy(true);
    try {
      await reorderHeroSlides(ordered.map((slide) => ({ id: slide.id, display_order: slide.display_order })));
      for (const slide of ordered) {
        const saved = savedRef.current[slide.id];
        if (saved) savedRef.current[slide.id] = { ...saved, display_order: slide.display_order };
      }
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to reorder slides."), "Reorder Failed");
      void load();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(slide: HeroSlideRecord) {
    if (!(await confirmDelete(`Remove the slide "${slide.title}" from this carousel?`, "Remove Slide"))) return;
    setBusy(true);
    try {
      await deleteHeroSlide(slide.id);
      delete savedRef.current[slide.id];
      setSlides((prev) => prev.filter((row) => row.id !== slide.id));
      showSuccess("Slide removed.", "Removed");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to remove this slide."), "Remove Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    const label = isHome ? "home page" : "login & register";
    const confirmed = await confirmAction(
      `This replaces every ${label} slide with the shipped defaults. Any custom slides and images for this carousel are lost.`,
      { title: "Reset to Default Slides", confirmText: "Reset Slides", variant: "warning" },
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      applyServerSlides(await resetHeroSlides(location));
      showSuccess(t.resetToastMessage, t.resetToastTitle);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to reset slides."), "Reset Failed");
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post<{ url: string }>("/super-admin/upload-image", formData);
    return data.url;
  }

  // ---- Add dialog ----------------------------------------------------------

  async function handleDialogFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      setUploadError("Please select a valid image file (PNG, JPG, WebP, GIF).");
      return;
    }
    setSelectedFile(file);
    setFilePreviewUrl(URL.createObjectURL(file));
    setUploadError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setNewSlide((prev) => ({ ...prev, image_url: url }));
    } catch (err: unknown) {
      setUploadError(extractErrorMessage(err, "Failed to upload image. You can also provide a direct URL."));
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleDialogFileSelect(file);
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
    if (file) void handleDialogFileSelect(file);
  }

  function handleOpenAddModal() {
    setNewSlide(emptyHeroSlideDraft(location));
    setSelectedFile(null);
    setFilePreviewUrl("");
    setUploadError(null);
    setUploading(false);
    setImageMode("upload");
    if (dialogFileInputRef.current) dialogFileInputRef.current.value = "";
    setIsAddModalOpen(true);
  }

  async function handleAddSlideSubmit(e: FormEvent) {
    e.preventDefault();
    const imageUrl = newSlide.image_url.trim();
    if (!imageUrl) {
      showError("Please upload an image or enter an Image URL.", "Image Required");
      return;
    }
    if (!newSlide.title.trim()) {
      showError("Please enter a slide title.", "Title Required");
      return;
    }
    setBusy(true);
    try {
      const created = await createHeroSlide({
        ...newSlide,
        location,
        image_url: imageUrl,
        title: newSlide.title.trim(),
        subtitle: (newSlide.subtitle || "").trim() || t.defaultSubtitle,
        badge: (newSlide.badge || "").trim() || t.defaultBadge,
        display_order: slides.length,
      });
      savedRef.current[created.id] = created;
      setSlides((prev) => [...prev, created]);
      setIsAddModalOpen(false);
      showSuccess(t.addedToastMessage, t.addedToastTitle);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to add the slide."), "Add Failed");
    } finally {
      setBusy(false);
    }
  }

  // ---- Per-slide image replacement ----------------------------------------

  function triggerSlideImageUpload(slideId: number) {
    targetSlideIdRef.current = slideId;
    slideFileInputRef.current?.click();
  }

  async function handleSlideFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slideId = targetSlideIdRef.current;
    if (!file || slideId === null) return;
    if (!file.type.startsWith("image/")) {
      showError("Please select a valid image file.", "Invalid Format");
      return;
    }
    setUpdatingSlideId(slideId);
    try {
      const url = await uploadImage(file);
      const current = slides.find((row) => row.id === slideId);
      if (current) {
        const updated = await updateHeroSlide(slideId, { ...toDraft(current), image_url: url });
        savedRef.current[updated.id] = updated;
        setSlides((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      }
      showSuccess("Slide image updated and live.", "Image Uploaded");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Failed to upload slide image."), "Upload Failed");
    } finally {
      setUpdatingSlideId(null);
      targetSlideIdRef.current = null;
      if (slideFileInputRef.current) slideFileInputRef.current.value = "";
    }
  }

  /** Switching carousels reloads from the server, so unsaved edits would be
   * dropped without warning. */
  async function handleLocationChange(next: HeroLocation) {
    if (next === location) return;
    if (dirtyCount > 0) {
      const confirmed = await confirmAction(
        `You have ${dirtyCount} unsaved slide change${dirtyCount === 1 ? "" : "s"}. Switching carousels discards ${dirtyCount === 1 ? "it" : "them"}.`,
        { title: "Discard Unsaved Changes?", confirmText: "Discard & Switch", variant: "warning" },
      );
      if (!confirmed) return;
    }
    setLocation(next);
  }

  // ---- Stat chips (home hero only) ----------------------------------------

  function editStat(slide: HeroSlideRecord, index: number, patch: { value?: string; label?: string }) {
    const stats = (slide.stats ?? []).map((stat, i) => (i === index ? { ...stat, ...patch } : stat));
    editSlide(slide.id, { stats });
  }

  function addStat(slide: HeroSlideRecord) {
    editSlide(slide.id, { stats: [...(slide.stats ?? []), { value: "", label: "" }] });
  }

  function removeStat(slide: HeroSlideRecord, index: number) {
    editSlide(slide.id, { stats: (slide.stats ?? []).filter((_, i) => i !== index) });
  }

  return (
    <CollapsiblePanel
      className="form-card wide developer-panel-card"
      title={t.title}
      description={t.description}
    >
      <input
        type="file"
        ref={slideFileInputRef}
        onChange={handleSlideFileChange}
        accept="image/*"
        style={{ display: "none" }}
      />

      <SegmentedControl
        ariaLabel="Hero carousel"
        className="hero-slider-location-tabs"
        onChange={(val) => void handleLocationChange(val as HeroLocation)}
        options={LOCATION_OPTIONS}
        value={location}
      />

      <p className="hint" style={{ margin: "0 0 14px 0", fontSize: 12.5 }}>
        {isHome ? t.homeHint : t.loginHint}
      </p>

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
          {dirtyCount > 0 && (
            <Button type="button" variant="primary" onClick={() => void handleSaveAll()} disabled={busy}>
              <Icon name="check" />
              Save {dirtyCount} change{dirtyCount === 1 ? "" : "s"}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => void handleReset()} disabled={busy}>
            <Icon name="restore" />
            {t.resetLabel}
          </Button>
          <Button type="button" variant="primary" onClick={handleOpenAddModal} disabled={busy}>
            <Icon name="plus" />
            {t.addLabel}
          </Button>
        </div>
      </div>

      {loading && <p className="hint">Loading slides...</p>}
      {loadError && <p className="error-text">{loadError}</p>}
      {!loading && !loadError && slides.length === 0 && (
        <p className="hint">No slides yet - add one, or reset to the shipped defaults.</p>
      )}

      <div className="login-slider-cards-list">
        {slides.map((slide, index) => {
          const dirty = isDirty(slide);
          return (
            <div key={slide.id} className={`slide-item-card${dirty ? " is-dirty" : ""}`}>
              <div className="slide-image-col">
                <div
                  className="slide-image-thumb-wrap"
                  onClick={() => triggerSlideImageUpload(slide.id)}
                  title="Click to choose a new image file from your computer"
                >
                  <img src={slide.image_url} alt={slide.title} className="slide-image-thumb" />
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

                <div className="slide-visibility-row">
                  <ToggleSwitch
                    checked={slide.is_active}
                    onChange={() => editSlide(slide.id, { is_active: !slide.is_active })}
                    tooltip={slide.is_active ? "Visible to visitors" : "Hidden from visitors"}
                  />
                  <span>{slide.is_active ? "Visible" : "Hidden"}</span>
                </div>
              </div>

              <div className="slide-card-fields">
                <div className="slide-field-group">
                  <label className="slide-field-label">{t.badgeLabel}</label>
                  <input
                    type="text"
                    placeholder={t.badgePlaceholder}
                    value={slide.badge ?? ""}
                    onChange={(e) => editSlide(slide.id, { badge: e.target.value })}
                    className="slide-badge-input"
                  />
                </div>

                <div className="slide-field-group">
                  <label className="slide-field-label">{isHome ? t.headingLabel : t.titleLabel}</label>
                  <textarea
                    placeholder={t.titlePlaceholder}
                    value={slide.title}
                    onChange={(e) => editSlide(slide.id, { title: e.target.value })}
                    className="slide-title-input"
                    rows={isHome ? 2 : 1}
                  />
                  {isHome && <span className="hint slide-field-hint">{t.headingHint}</span>}
                </div>

                {isHome && (
                  <div className="slide-field-group">
                    <label className="slide-field-label">{t.highlightLabel}</label>
                    <input
                      type="text"
                      placeholder={t.highlightPlaceholder}
                      value={slide.highlight ?? ""}
                      onChange={(e) => editSlide(slide.id, { highlight: e.target.value })}
                      className="slide-title-input"
                    />
                  </div>
                )}

                <div className="slide-field-group">
                  <label className="slide-field-label">{isHome ? t.descLabel : t.subtitleLabel}</label>
                  <textarea
                    placeholder={t.subtitlePlaceholder}
                    value={slide.subtitle ?? ""}
                    onChange={(e) => editSlide(slide.id, { subtitle: e.target.value })}
                    className="slide-subtitle-input"
                    rows={2}
                  />
                </div>

                {isHome && (
                  <>
                    <div className="slide-field-row">
                      <div className="slide-field-group">
                        <label className="slide-field-label">{t.ctaTextLabel}</label>
                        <input
                          type="text"
                          placeholder="Start Practising Free"
                          value={slide.cta_text ?? ""}
                          onChange={(e) => editSlide(slide.id, { cta_text: e.target.value })}
                          className="slide-subtitle-input"
                        />
                      </div>
                      <div className="slide-field-group">
                        <label className="slide-field-label">{t.ctaLinkLabel}</label>
                        <input
                          type="text"
                          placeholder="/register"
                          value={slide.cta_link ?? ""}
                          onChange={(e) => editSlide(slide.id, { cta_link: e.target.value })}
                          className="slide-url-input"
                        />
                      </div>
                    </div>

                    <div className="slide-field-row">
                      <div className="slide-field-group">
                        <label className="slide-field-label">{t.altTextLabel}</label>
                        <input
                          type="text"
                          placeholder="View Student Plans →"
                          value={slide.alt_text ?? ""}
                          onChange={(e) => editSlide(slide.id, { alt_text: e.target.value })}
                          className="slide-subtitle-input"
                        />
                      </div>
                      <div className="slide-field-group">
                        <label className="slide-field-label">{t.altLinkLabel}</label>
                        <input
                          type="text"
                          placeholder="/plans or #features"
                          value={slide.alt_link ?? ""}
                          onChange={(e) => editSlide(slide.id, { alt_link: e.target.value })}
                          className="slide-url-input"
                        />
                      </div>
                    </div>

                    <div className="slide-field-group">
                      <label className="slide-field-label">{t.statsLabel}</label>
                      <div className="slide-stats-editor">
                        {(slide.stats ?? []).map((stat, statIndex) => (
                          <div className="slide-stat-row" key={statIndex}>
                            <input
                              type="text"
                              placeholder="4 Skills"
                              value={stat.value}
                              onChange={(e) => editStat(slide, statIndex, { value: e.target.value })}
                              className="slide-title-input"
                            />
                            <input
                              type="text"
                              placeholder="All Exam Modules"
                              value={stat.label}
                              onChange={(e) => editStat(slide, statIndex, { label: e.target.value })}
                              className="slide-subtitle-input"
                            />
                            <button
                              type="button"
                              className="slide-remove-btn"
                              onClick={() => removeStat(slide, statIndex)}
                              title="Remove this stat"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <Button type="button" variant="secondary" size="sm" onClick={() => addStat(slide)}>
                          <Icon name="plus" />
                          {t.addStatLabel}
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <div className="slide-field-group">
                  <label className="slide-field-label">{t.imageUrlLabel}</label>
                  <input
                    type="text"
                    placeholder={t.imageUrlPlaceholder}
                    value={slide.image_url}
                    onChange={(e) => editSlide(slide.id, { image_url: e.target.value })}
                    className="slide-url-input"
                  />
                </div>
              </div>

              <div className="slide-card-actions">
                <div className="slide-order-buttons">
                  <button
                    type="button"
                    className="slide-order-btn"
                    onClick={() => void handleMove(index, -1)}
                    disabled={index === 0 || busy}
                    title="Move earlier in the carousel"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="slide-order-btn"
                    onClick={() => void handleMove(index, 1)}
                    disabled={index === slides.length - 1 || busy}
                    title="Move later in the carousel"
                  >
                    ↓
                  </button>
                </div>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => void handleSaveSlide(slide)}
                  disabled={!dirty || savingId === slide.id}
                >
                  {savingId === slide.id ? "Saving..." : dirty ? "Save" : "Saved"}
                </Button>

                {dirty && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => handleRevert(slide)}>
                    Revert
                  </Button>
                )}

                <button
                  type="button"
                  className="slide-remove-btn"
                  onClick={() => void handleRemove(slide)}
                  title="Remove this slide"
                  disabled={busy}
                >
                  {t.removeLabel}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        size="md"
        title={isHome ? t.addHomeSectionTitle : t.addSectionTitle}
        actions={
          <>
            <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={uploading || busy || !newSlide.image_url || !newSlide.title.trim()}
              onClick={(e) => void handleAddSlideSubmit(e as unknown as FormEvent)}
            >
              <Icon name="plus" />
              {t.addLabel}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => void handleAddSlideSubmit(e)} className="add-slide-dialog-form">
          <p className="hint" style={{ margin: "0 0 12px 0", fontSize: 13 }}>
            {isHome ? t.addHomeSectionDescription : t.addSectionDescription}
          </p>

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
                        setNewSlide((prev) => ({ ...prev, image_url: "" }));
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

          {imageMode === "url" && (
            <div>
              <input
                type="url"
                placeholder={t.imageUrlInputPlaceholder}
                value={newSlide.image_url}
                onChange={(e) => setNewSlide((prev) => ({ ...prev, image_url: e.target.value }))}
                required
              />
              {newSlide.image_url && (
                <div className="slide-preview-card" style={{ marginTop: 10, height: 140 }}>
                  <img src={newSlide.image_url} alt="Slide URL Preview" />
                </div>
              )}
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
              {t.badgeLabel}
            </label>
            <input
              type="text"
              placeholder={t.badgeInputPlaceholder}
              value={newSlide.badge ?? ""}
              onChange={(e) => setNewSlide((prev) => ({ ...prev, badge: e.target.value }))}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
              {isHome ? t.headingLabel : t.titleLabel} <RequiredMark />
            </label>
            <textarea
              placeholder={t.titleInputPlaceholder}
              value={newSlide.title}
              onChange={(e) => setNewSlide((prev) => ({ ...prev, title: e.target.value }))}
              rows={2}
              style={{ width: "100%", resize: "vertical", fontSize: 13 }}
              required
            />
            {isHome && <span className="hint slide-field-hint">{t.headingHint}</span>}
          </div>

          {isHome && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                {t.highlightLabel}
              </label>
              <input
                type="text"
                placeholder={t.highlightPlaceholder}
                value={newSlide.highlight ?? ""}
                onChange={(e) => setNewSlide((prev) => ({ ...prev, highlight: e.target.value }))}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
              {isHome ? t.descLabel : t.subtitleLabel}
            </label>
            <textarea
              placeholder={t.subtitleInputPlaceholder}
              value={newSlide.subtitle ?? ""}
              onChange={(e) => setNewSlide((prev) => ({ ...prev, subtitle: e.target.value }))}
              rows={2}
              style={{ width: "100%", resize: "vertical", fontSize: 13 }}
            />
          </div>

          {isHome && (
            <>
              <div className="slide-field-row">
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    {t.ctaTextLabel}
                  </label>
                  <input
                    type="text"
                    placeholder="Start Practising Free"
                    value={newSlide.cta_text ?? ""}
                    onChange={(e) => setNewSlide((prev) => ({ ...prev, cta_text: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    {t.ctaLinkLabel}
                  </label>
                  <input
                    type="text"
                    placeholder="/register"
                    value={newSlide.cta_link ?? ""}
                    onChange={(e) => setNewSlide((prev) => ({ ...prev, cta_link: e.target.value }))}
                  />
                </div>
              </div>
              <div className="slide-field-row">
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    {t.altTextLabel}
                  </label>
                  <input
                    type="text"
                    placeholder="View Student Plans →"
                    value={newSlide.alt_text ?? ""}
                    onChange={(e) => setNewSlide((prev) => ({ ...prev, alt_text: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    {t.altLinkLabel}
                  </label>
                  <input
                    type="text"
                    placeholder="/plans or #features"
                    value={newSlide.alt_link ?? ""}
                    onChange={(e) => setNewSlide((prev) => ({ ...prev, alt_link: e.target.value }))}
                  />
                </div>
              </div>
              <p className="hint" style={{ margin: 0, fontSize: 12 }}>
                {t.statsAfterCreateHint}
              </p>
            </>
          )}
        </form>
      </Modal>
    </CollapsiblePanel>
  );
}
