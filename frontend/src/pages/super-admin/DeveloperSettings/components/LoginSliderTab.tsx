import { type FormEvent, useState } from "react";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
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
    <CollapsiblePanel className="form-card wide" title={t.title} description={t.description}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          className="secondary-button"
          type="button"
          onClick={() => {
            resetSlides();
            showSuccess(t.resetToastMessage, t.resetToastTitle);
          }}
        >
          {t.resetLabel}
        </button>
      </div>

      <CollapsiblePanel
        className="nested-collapsible-panel"
        title={t.currentSlidesTitle}
        description={t.currentSlidesDescription}
        badge={<span className="count-chip">{slides.length}</span>}
      >
        <div style={{ display: "grid", gap: 20, marginBottom: 20 }}>
          {slides.map((slide) => (
            <div
              key={slide.id}
              style={{ display: "flex", gap: 20, background: "var(--slate-50)", padding: 16, borderRadius: 14, border: "1px solid var(--slate-200)", alignItems: "center" }}
            >
              <img src={slide.imageUrl} alt={slide.title} style={{ width: 140, height: 90, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <input
                    type="text"
                    placeholder={t.badgePlaceholder}
                    value={slide.badge}
                    onChange={(e) => updateSlide(slide.id, { badge: e.target.value })}
                    style={{ width: "200px", padding: "6px 10px", fontSize: "12px", fontWeight: 600 }}
                  />
                  <input
                    type="text"
                    placeholder={t.titlePlaceholder}
                    value={slide.title}
                    onChange={(e) => updateSlide(slide.id, { title: e.target.value })}
                    style={{ flex: 1, padding: "6px 10px", fontSize: "13px", fontWeight: 600 }}
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
                  style={{ padding: "6px 10px", fontSize: "12px" }}
                />
              </div>
              {slides.length > 1 && (
                <button className="danger" type="button" onClick={() => removeSlide(slide.id)}>
                  {t.removeLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel className="nested-collapsible-panel compact" title={t.addSectionTitle} description={t.addSectionDescription}>
        <form onSubmit={handleAdd} style={{ display: "grid", gap: 12, maxWidth: 600 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t.imageUrlLabel}</label>
            <input type="url" placeholder={t.imageUrlInputPlaceholder} value={newUrl} onChange={(e) => setNewUrl(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t.titleLabel}</label>
            <input type="text" placeholder={t.titleInputPlaceholder} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t.subtitleLabel}</label>
            <input type="text" placeholder={t.subtitleInputPlaceholder} value={newSubtitle} onChange={(e) => setNewSubtitle(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>{t.badgeLabel}</label>
            <input type="text" placeholder={t.badgeInputPlaceholder} value={newBadge} onChange={(e) => setNewBadge(e.target.value)} />
          </div>
          <button type="submit" style={{ justifySelf: "start", padding: "10px 20px" }}>
            {t.addLabel}
          </button>
        </form>
      </CollapsiblePanel>
    </CollapsiblePanel>
  );
}
