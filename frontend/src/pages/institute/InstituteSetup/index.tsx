import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, PageHeader } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { RenewPlanCard } from "../InstituteBilling/components/RenewPlanCard";
import { instituteSetupStrings as strings } from "./InstituteSetup.strings";

interface Branding {
  primary_color: string | null;
  secondary_color: string | null;
  logo_url: string | null;
}

/**
 * First-run setup for an institute that has just been approved.
 *
 * Nothing here is a formality: until a term is paid for the institute has no
 * seats, so the portal is genuinely unusable. Branding comes first because it
 * is quick and optional; the plan step is the one that unlocks everything, and
 * it reuses the same card the billing page renews from - the server already
 * reports this institute as needing activation rather than renewal.
 */
export function InstituteSetup() {
  const user = useAuthStore((state) => state.user);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const fileInput = useRef<HTMLInputElement>(null);

  const [branding, setBranding] = useState<Branding | null>(null);
  const [primary, setPrimary] = useState("#4f46e5");
  const [secondary, setSecondary] = useState("#0ea5e9");
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    apiClient
      .get<Branding>("/institute/branding")
      .then(({ data }) => {
        setBranding(data);
        if (data.primary_color) setPrimary(data.primary_color);
        if (data.secondary_color) setSecondary(data.secondary_color);
      })
      // Branding is optional, so a failed read leaves the defaults in place
      // rather than blocking the step that actually matters.
      .catch(() => setBranding(null));
  }, []);

  async function saveBranding() {
    setSavingBranding(true);
    try {
      const { data } = await apiClient.put<Branding>("/institute/branding", {
        primary_color: primary,
        secondary_color: secondary,
      });
      setBranding(data);
      showSuccess(strings.steps.branding.saved);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.errors.branding));
    } finally {
      setSavingBranding(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const { data } = await apiClient.post<Branding>("/institute/branding/logo", body);
      setBranding(data);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, strings.errors.logo));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const b = strings.steps.branding;
  const p = strings.steps.plan;

  return (
    <div className="institute-setup">
      <PageHeader
        eyebrow={strings.eyebrow}
        title={strings.title(user?.institute_slug ?? "your institute")}
        subtitle={strings.subtitle}
      />

      <section className="form-card wide setup-step">
        <header className="setup-step-head">
          <span className="setup-step-number">{b.number}</span>
          <div>
            <h2>{b.title}</h2>
            <p className="hint">{b.description}</p>
          </div>
        </header>

        <div className="form-grid">
          <div>
            <label>{b.primary}</label>
            <input type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} />
          </div>
          <div>
            <label>{b.secondary}</label>
            <input type="color" value={secondary} onChange={(event) => setSecondary(event.target.value)} />
          </div>
          <div>
            <label>{b.logo}</label>
            {branding?.logo_url && <img className="setup-logo-preview" src={branding.logo_url} alt="" />}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
            <small className="hint">{uploading ? b.uploading : b.logoHint}</small>
          </div>
        </div>

        <div className="form-actions">
          <Button type="button" onClick={saveBranding} loading={savingBranding} disabled={savingBranding}>
            {savingBranding ? b.saving : b.save}
          </Button>
        </div>
        <p className="hint">{b.skip}</p>
      </section>

      <section className="setup-step">
        <header className="setup-step-head">
          <span className="setup-step-number">{p.number}</span>
          <div>
            <h2>{p.title}</h2>
            <p className="hint">{p.description}</p>
          </div>
        </header>

        {/* Once this succeeds the institute has a live term, so the setup guard
            stops matching and the normal portal takes over on reload. */}
        <RenewPlanCard onRenewed={() => window.location.assign("/institute-portal/dashboard")} />
      </section>
    </div>
  );
}
