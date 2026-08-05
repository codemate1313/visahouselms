import { type FormEvent, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Icon, type IconName } from "@/components/icons";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { RequiredMark } from "@/components/ui";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import { developerSettingsStrings as strings } from "../DeveloperSettings.strings";
import type { ContactInfo, SocialLinkRow, SocialPlatform } from "../types";

const PLATFORM_ICONS: Record<SocialPlatform, IconName> = {
  linkedin: "socialLinkedin",
  github: "socialGithub",
  instagram: "socialInstagram",
  youtube: "socialYoutube",
  facebook: "socialFacebook",
  twitter: "socialTwitter",
  tiktok: "socialTiktok",
  website: "socialWebsite",
};

const PLATFORM_OPTIONS = Object.keys(PLATFORM_ICONS) as SocialPlatform[];

interface ContactForm {
  email: string;
  email_note: string;
  phone: string;
  phone_note: string;
  support_url: string;
  support_note: string;
  office_name: string;
  office_address: string;
}

const EMPTY_FORM: ContactForm = {
  email: "",
  email_note: "",
  phone: "",
  phone_note: "",
  support_url: "",
  support_note: "",
  office_name: "",
  office_address: "",
};

function toForm(contact: ContactInfo): ContactForm {
  return {
    email: contact.email,
    email_note: contact.email_note ?? "",
    phone: contact.phone,
    phone_note: contact.phone_note ?? "",
    support_url: contact.support_url,
    support_note: contact.support_note ?? "",
    office_name: contact.office_name,
    office_address: contact.office_address,
  };
}

export function ContactSocialTab() {
  const t = strings.contact;
  const showInfo = useToastStore((state) => state.showInfo);

  const [form, setForm] = useState<ContactForm>(EMPTY_FORM);
  const originalRef = useRef<ContactForm | null>(null);
  const [links, setLinks] = useState<SocialLinkRow[]>([]);
  const [linkUrlDrafts, setLinkUrlDrafts] = useState<Record<number, string>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [addPlatform, setAddPlatform] = useState<SocialPlatform>("linkedin");
  const [addUrl, setAddUrl] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<{ contact: ContactInfo; social_links: SocialLinkRow[] }>(
        "/super-admin/contact-settings"
      );
      const nextForm = toForm(data.contact);
      setForm(nextForm);
      originalRef.current = nextForm;
      setLinks(data.social_links);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.loadError));
    } finally {
      setLoading(false);
    }
  }

  async function saveContact(event: FormEvent) {
    event.preventDefault();
    if (originalRef.current && isEqual(originalRef.current, form)) {
      showInfo(noChangesMessage);
      return;
    }
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const { data } = await apiClient.put<{ contact: ContactInfo; social_links: SocialLinkRow[] }>(
        "/super-admin/contact-settings/contact",
        form
      );
      const nextForm = toForm(data.contact);
      setForm(nextForm);
      originalRef.current = nextForm;
      setNotice(t.saveInfoSuccess);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.saveInfoError));
    } finally {
      setSaving(false);
    }
  }

  async function toggleLink(link: SocialLinkRow) {
    try {
      const { data } = await apiClient.patch<{ social_links: SocialLinkRow[] }>(
        `/super-admin/contact-settings/social-links/${link.id}`,
        { is_enabled: !link.is_enabled }
      );
      setLinks(data.social_links);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.updateError));
    }
  }

  async function saveLinkUrl(link: SocialLinkRow) {
    const draft = linkUrlDrafts[link.id];
    if (draft === undefined || draft === link.url) return;
    try {
      const { data } = await apiClient.patch<{ social_links: SocialLinkRow[] }>(
        `/super-admin/contact-settings/social-links/${link.id}`,
        { url: draft }
      );
      setLinks(data.social_links);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.updateError));
    }
  }

  async function removeLink(link: SocialLinkRow) {
    try {
      const { data } = await apiClient.delete<{ social_links: SocialLinkRow[] }>(
        `/super-admin/contact-settings/social-links/${link.id}`
      );
      setLinks(data.social_links);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, t.removeError));
    }
  }

  async function handleAddLink(event: FormEvent) {
    event.preventDefault();
    if (!addUrl.trim()) return;
    setAddBusy(true);
    setAddError(null);
    try {
      const { data } = await apiClient.post<{ social_links: SocialLinkRow[] }>(
        "/super-admin/contact-settings/social-links",
        { platform: addPlatform, url: addUrl.trim(), is_enabled: true }
      );
      setLinks(data.social_links);
      setAddUrl("");
    } catch (err: unknown) {
      setAddError(extractErrorMessage(err, t.addError));
    } finally {
      setAddBusy(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <form onSubmit={saveContact} className="form-card wide collapsible-form-card">
        <CollapsiblePanel className="form-card-collapsible" title={t.infoTitle} description={t.infoDescription}>
          <div className="form-grid">
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.emailLabel}<RequiredMark /></label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>Note</label>
              <input
                value={form.email_note}
                onChange={(e) => setForm({ ...form, email_note: e.target.value })}
                placeholder={t.emailNotePlaceholder}
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.phoneLabel}<RequiredMark /></label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>Note</label>
              <input
                value={form.phone_note}
                onChange={(e) => setForm({ ...form, phone_note: e.target.value })}
                placeholder={t.phoneNotePlaceholder}
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.supportUrlLabel}<RequiredMark /></label>
              <input
                value={form.support_url}
                onChange={(e) => setForm({ ...form, support_url: e.target.value })}
                required
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>Note</label>
              <input
                value={form.support_note}
                onChange={(e) => setForm({ ...form, support_note: e.target.value })}
                placeholder={t.supportNotePlaceholder}
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.officeNameLabel}<RequiredMark /></label>
              <input
                value={form.office_name}
                onChange={(e) => setForm({ ...form, office_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.officeAddressLabel}<RequiredMark /></label>
            <textarea
              rows={3}
              value={form.office_address}
              onChange={(e) => setForm({ ...form, office_address: e.target.value })}
              placeholder={t.officeAddressPlaceholder}
              required
            />
          </div>

          {error && <p className="error-text">{error}</p>}
          {notice && <p className="success-text">{notice}</p>}

          <div className="form-actions" style={{ marginTop: "1.25rem" }}>
            <button type="submit" disabled={saving} className="btn-primary">
              <Icon name="check" style={{ fontSize: "16px" }} />
              {saving ? "Saving..." : t.saveInfoLabel}
            </button>
          </div>
        </CollapsiblePanel>
      </form>

      <CollapsiblePanel className="form-card wide developer-panel-card" title={t.socialTitle} description={t.socialDescription}>
        <div className="login-slider-two-col">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <CollapsiblePanel
              className="nested-collapsible-panel"
              title={t.currentLinksTitle}
              badge={<span className="count-chip">{links.length}</span>}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {links.length === 0 && <p className="text-muted">{t.noLinksMessage}</p>}
                {links.map((link) => (
                  <div
                    key={link.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      background: "var(--surface, #ffffff)",
                      padding: 12,
                      borderRadius: 12,
                      border: "1px solid var(--border, var(--border))",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "var(--surface-subtle, #f8fafc)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name={PLATFORM_ICONS[link.platform]} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted, var(--slate-500))", marginBottom: 4 }}>
                        {strings.contact.platformLabels[link.platform] ?? link.platform}
                      </div>
                      <input
                        value={linkUrlDrafts[link.id] ?? link.url}
                        onChange={(e) => setLinkUrlDrafts({ ...linkUrlDrafts, [link.id]: e.target.value })}
                        onBlur={() => saveLinkUrl(link)}
                        placeholder={t.urlPlaceholder}
                        style={{ padding: "6px 10px", fontSize: "12.5px", width: "100%" }}
                      />
                    </div>
                    <ToggleSwitch
                      checked={link.is_enabled}
                      onChange={() => toggleLink(link)}
                      tooltip={link.is_enabled ? "Enabled" : "Disabled"}
                    />
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => removeLink(link)}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        color: "#dc2626",
                        borderColor: "rgba(220, 38, 38, 0.2)",
                        background: "rgba(254, 242, 242, 0.6)",
                        flexShrink: 0,
                      }}
                    >
                      {t.removeLabel}
                    </button>
                  </div>
                ))}
              </div>
            </CollapsiblePanel>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <CollapsiblePanel className="nested-collapsible-panel compact" title={t.addSectionTitle} description={t.addSectionDescription}>
              <form onSubmit={handleAddLink} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>{t.platformLabel}</label>
                  <select value={addPlatform} onChange={(e) => setAddPlatform(e.target.value as SocialPlatform)}>
                    {PLATFORM_OPTIONS.map((platform) => (
                      <option key={platform} value={platform}>
                        {strings.contact.platformLabels[platform]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, display: "block", marginBottom: 4 }}>
                    URL <RequiredMark />
                  </label>
                  <input
                    type="url"
                    value={addUrl}
                    onChange={(e) => setAddUrl(e.target.value)}
                    placeholder={t.urlPlaceholder}
                    required
                  />
                </div>
                {addError && <p className="error-text">{addError}</p>}
                <div style={{ paddingTop: 8 }}>
                  <button type="submit" className="button primary" style={{ width: "100%" }} disabled={addBusy}>
                    {addBusy ? "Adding..." : t.addLabel}
                  </button>
                </div>
              </form>
            </CollapsiblePanel>
          </div>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
