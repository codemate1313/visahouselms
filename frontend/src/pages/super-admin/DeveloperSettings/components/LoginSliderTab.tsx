import { type FormEvent, useState } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { RequiredMark } from "@/components/ui";
import { useLoginSliderStore } from "@/store/loginSliderStore";
import { useToastStore } from "@/store/toastStore";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";

export function LoginSliderTab() {
  const { slides, updateSlide, addSlide, removeSlide, resetSlides } = useLoginSliderStore();
  const showSuccess = useToastStore((state) => state.showSuccess);
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [newBadge, setNewBadge] = useState("IELTS LMS PLATFORM");
  const t = strings.slider;

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!newUrl || !newTitle) return;
    addSlide({
      imageUrl: newUrl.trim(),
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || t.defaultSubtitle,
      badge: newBadge.trim() || t.defaultBadge,
    });
    setNewUrl("");
    setNewTitle("");
    setNewSubtitle("");
    showSuccess(t.addedToastMessage, t.addedToastTitle);
  }

  return (
    <CollapsiblePanel className="form-card wide developer-panel-card" title={t.title} description={t.description}>
      <div className="login-slider-two-col">
        {/* Left Column: Current Slides List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CollapsiblePanel
            className="nested-collapsible-panel"
            title={t.currentSlidesTitle}
            description={t.currentSlidesDescription}
            badge={<span className="count-chip">{slides.length}</span>}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 12 }}>
              {slides.map((slide) => (
                <div
                  key={slide.id}
                  style={{
                    display: "flex",
                    gap: 16,
                    background: "var(--surface, #ffffff)",
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid var(--border, var(--border))",
                    alignItems: "center",
                    boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
                  }}
                >
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    style={{ width: 130, height: 95, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8 }}>
                      <input
                        type="text"
                        placeholder={t.badgePlaceholder}
                        value={slide.badge}
                        onChange={(e) => updateSlide(slide.id, { badge: e.target.value })}
                        style={{ padding: "6px 10px", fontSize: "11.5px", fontWeight: 700, textTransform: "uppercase" }}
                      />
                      <input
                        type="text"
                        placeholder={t.titlePlaceholder}
                        value={slide.title}
                        onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
                        style={{ padding: "6px 10px", fontSize: "13px", fontWeight: 700 }}
                      />
                    </div>
                    <input
                      type="text"
                      placeholder={t.subtitlePlaceholder}
                      value={slide.subtitle}
                      onChange={(e) => updateSlide(slide.id, { subtitle: e.target.value })}
                      style={{ padding: "6px 10px", fontSize: "12px" }}
                    />
                    <input
                      type="text"
                      placeholder={t.imageUrlPlaceholder}
                      value={slide.imageUrl}
                      onChange={(e) => updateSlide(slide.id, { imageUrl: e.target.value })}
                      style={{ padding: "6px 10px", fontSize: "11.5px", fontFamily: "monospace" }}
                    />
                  </div>
                  {slides.length > 1 && (
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => removeSlide(slide.id)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        color: "#dc2626",
                        borderColor: "rgba(220, 38, 38, 0.2)",
                        background: "rgba(254, 242, 242, 0.6)",
                      }}
                    >
                      {t.removeLabel}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </CollapsiblePanel>
        </div>

        {/* Right Column: Add Custom Slide Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CollapsiblePanel
            className="nested-collapsible-panel compact"
            title={t.addSectionTitle}
            description={t.addSectionDescription}
          >
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
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

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                  {t.subtitleLabel}
                </label>
                <input
                  type="text"
                  placeholder={t.subtitleInputPlaceholder}
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                  {t.imageUrlLabel} <RequiredMark />
                </label>
                <input
                  type="url"
                  placeholder={t.imageUrlInputPlaceholder}
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  required
                />
              </div>

              <div style={{ paddingTop: 8 }}>
                <button type="submit" className="button primary" style={{ width: "100%" }}>
                  {t.addLabel}
                </button>
              </div>
            </form>
          </CollapsiblePanel>
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            resetSlides();
            showSuccess(t.resetToastMessage, t.resetToastTitle);
          }}
        >
          {t.resetLabel}
        </button>
      </div>
    </CollapsiblePanel>
  );
}
