import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Icon, type IconName } from "@/components/icons";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { Button, RequiredMark } from "@/components/ui";
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
  head_office_name: string;
  head_office_address: string;
  head_office_map_link: string;
  head_office_map_embed: string;
  branch_office_name: string;
  branch_office_address: string;
  branch_office_map_link: string;
  branch_office_map_embed: string;
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
  head_office_name: "",
  head_office_address: "",
  head_office_map_link: "",
  head_office_map_embed: "",
  branch_office_name: "",
  branch_office_address: "",
  branch_office_map_link: "",
  branch_office_map_embed: "",
};

function toForm(contact: ContactInfo): ContactForm {
  return {
    email: contact.email || "enquiry.langugaecert@gmail.com",
    email_note: contact.email_note ?? "",
    phone: contact.phone || "+91 9779047164",
    phone_note: contact.phone_note || "Mon–Fri · 9am to 5pm IST",
    support_url: contact.support_url || "support.visahouse.com (to be created)",
    support_note: contact.support_note ?? "",
    office_name: contact.office_name || "Visa House Immigration",
    office_address: contact.office_address || "Mezzanine floor, Sco-21, B-Block, Ranjit Avenue, Amritsar, Punjab 143001",
    head_office_name: contact.head_office_name || "Amritsar Office (Head Office)",
    head_office_address: contact.head_office_address || "Mezzanine floor, Sco-21, B-Block, Ranjit Avenue, Amritsar, Punjab 143001",
    head_office_map_link: contact.head_office_map_link || "https://www.google.com/maps/place/VISA+HOUSE+immigration/@31.65075,74.8629167,17z",
    head_office_map_embed: contact.head_office_map_embed || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3692.6816320116436!2d74.8629167!3d31.65075!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3919650028ff0af9%3A0x7c60b7408534d94d!2sVISA%20HOUSE%20immigration!5e0!3m2!1sen!2sin!4v1786779632431!5m2!1sen!2sin",
    branch_office_name: contact.branch_office_name || "Tarn Taran Office (Branch Office)",
    branch_office_address: contact.branch_office_address || "Gali Lakeer Sahib Wali, Amritsar Bypass Road, Tarn Taran, Punjab 143401",
    branch_office_map_link: contact.branch_office_map_link || "https://maps.app.goo.gl/9DfwXmJcfyzQnwC67",
    branch_office_map_embed: contact.branch_office_map_embed || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3403.475908208477!2d74.9170435!3d31.4638482!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39197f991e05cd0f%3A0x64c8d99f3ec4c656!2sVisa%20House!5e0!3m2!1sen!2sin!4v1786779800000!5m2!1sen!2sin",
  };
}

export function ContactSocialTab() {
  const t = strings.contact;
  const showInfo = useToastStore((state) => state.showInfo);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

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

  const load = useCallback(async () => {
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
  }, [t.loadError]);

  useEffect(() => {
    void load();
  }, [load]);

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
      showSuccess(t.saveInfoSuccess);
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, t.saveInfoError);
      setError(msg);
      showError(msg);
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
          <h3 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--primary)" }}>
            Communication Channels
          </h3>
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
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>Note / Hours</label>
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

          <hr style={{ margin: "1.5rem 0", borderColor: "var(--border, rgba(255, 255, 255, 0.1))" }} />

          {/* Head Office (Amritsar) */}
          <h3 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--primary)" }}>
            {t.headOfficeTitle}
          </h3>
          <div className="form-grid">
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.headOfficeNameLabel}<RequiredMark /></label>
              <input
                value={form.head_office_name}
                onChange={(e) => setForm({ ...form, head_office_name: e.target.value })}
                placeholder="Amritsar Office (Head Office)"
                required
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.headOfficeMapLinkLabel}<RequiredMark /></label>
              <input
                type="url"
                value={form.head_office_map_link}
                onChange={(e) => setForm({ ...form, head_office_map_link: e.target.value })}
                placeholder="https://www.google.com/maps/place/..."
                required
              />
            </div>
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.headOfficeAddressLabel}<RequiredMark /></label>
            <textarea
              rows={2}
              value={form.head_office_address}
              onChange={(e) => setForm({ ...form, head_office_address: e.target.value })}
              placeholder="Full address of Amritsar Head Office"
              required
            />
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.headOfficeMapEmbedLabel}</label>
            <input
              value={form.head_office_map_embed}
              onChange={(e) => setForm({ ...form, head_office_map_embed: e.target.value })}
              placeholder="https://www.google.com/maps/embed?pb=..."
            />
          </div>

          <hr style={{ margin: "1.5rem 0", borderColor: "var(--border, rgba(255, 255, 255, 0.1))" }} />

          {/* Branch Office (Tarn Taran) */}
          <h3 style={{ fontSize: "0.875rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--primary)" }}>
            {t.branchOfficeTitle}
          </h3>
          <div className="form-grid">
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.branchOfficeNameLabel}<RequiredMark /></label>
              <input
                value={form.branch_office_name}
                onChange={(e) => setForm({ ...form, branch_office_name: e.target.value })}
                placeholder="Tarn Taran Office (Branch Office)"
                required
              />
            </div>
            <div>
              <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.branchOfficeMapLinkLabel}<RequiredMark /></label>
              <input
                type="url"
                value={form.branch_office_map_link}
                onChange={(e) => setForm({ ...form, branch_office_map_link: e.target.value })}
                placeholder="https://maps.app.goo.gl/..."
                required
              />
            </div>
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.branchOfficeAddressLabel}<RequiredMark /></label>
            <textarea
              rows={2}
              value={form.branch_office_address}
              onChange={(e) => setForm({ ...form, branch_office_address: e.target.value })}
              placeholder="Full address of Tarn Taran Branch Office"
              required
            />
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <label style={{ fontWeight: 700, fontSize: "0.8125rem" }}>{t.branchOfficeMapEmbedLabel}</label>
            <input
              value={form.branch_office_map_embed}
              onChange={(e) => setForm({ ...form, branch_office_map_embed: e.target.value })}
              placeholder="https://www.google.com/maps/embed?pb=..."
            />
          </div>

          {error && <p className="error-text" style={{ marginTop: "1rem" }}>{error}</p>}
          {notice && <p className="success-text" style={{ marginTop: "1rem" }}>{notice}</p>}

          <div className="form-actions" style={{ marginTop: "1.25rem" }}>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              leftIcon={<Icon name="check" />}
            >
              {saving ? "Saving..." : t.saveInfoLabel}
            </Button>
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
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={addBusy}
                    leftIcon={<Icon name="plus" />}
                  >
                    {addBusy ? "Adding..." : t.addLabel}
                  </Button>
                </div>
              </form>
            </CollapsiblePanel>
          </div>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
