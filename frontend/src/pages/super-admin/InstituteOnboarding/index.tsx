import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { instituteOnboardingStrings as strings } from "./InstituteOnboarding.strings";
import { INITIAL } from "./helpers";
import type { Method, ModuleOption, Onboarding } from "./types";
import { OnboardingStepper } from "./components/OnboardingStepper";
import { Step1AgreementForm } from "./components/Step1AgreementForm";
import { Step2BrandingForm } from "./components/Step2BrandingForm";
import { Step3PublishSummary } from "./components/Step3PublishSummary";
import { LinkButton, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

export function InstituteOnboarding() {
  const { id } = useParams();
  const [step, setStep] = useState(id ? 2 : 1);
  const [form, setForm] = useState(INITIAL);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<number>>(new Set());
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [adminCredential, setAdminCredential] = useState<{ email: string; password: string } | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const instituteId = onboarding?.id || (id ? Number(id) : null);

  async function loadOnboarding(targetId: number) {
    const { data: record } = await apiClient.get<Onboarding>(`/super-admin/onboarding/${targetId}`);
    setOnboarding(record);
    setSelectedModules(new Set(record.module_ids || []));
    setForm((current) => ({
      ...current,
      primary_color: record.branding?.primary_color || current.primary_color,
      secondary_color: record.branding?.secondary_color || current.secondary_color,
    }));
    if (record.onboarding_status === "published") setStep(3);
  }

  useEffect(() => {
    Promise.all([
      apiClient.get<ModuleOption[]>("/super-admin/plans/available-modules"),
      apiClient.get<Method[]>("/super-admin/payment-methods", { params: { active_only: true } }),
    ]).then(([moduleResponse, methodResponse]) => {
      setModules(moduleResponse.data);
      setMethods(methodResponse.data);
    });
    if (id) loadOnboarding(Number(id)).catch(() => setError(strings.errors.load));
  }, [id]);

  function set(field: keyof typeof INITIAL) {
    return (event: { target: { value: string } }) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function toggleModule(moduleId: number) {
    setSelectedModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId);
      return next;
    });
  }

  function toggleAllModules() {
    setSelectedModules((current) => current.size === modules.length ? new Set() : new Set(modules.map((module) => module.id)));
  }



  const existingLogoSrc = onboarding?.branding?.logo_url ? `${API_BASE_URL}${onboarding.branding.logo_url}` : null;
  const uploadedLogoSrc = useMemo(() => (logo ? URL.createObjectURL(logo) : null), [logo]);

  useEffect(() => {
    return () => {
      if (uploadedLogoSrc) URL.revokeObjectURL(uploadedLogoSrc);
    };
  }, [uploadedLogoSrc]);

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!form.payment_method_id) {
      setError(strings.errors.paymentMethodRequired);
      return;
    }
    if (Number(form.amount_received) > Number(form.agreed_amount)) {
      setError(strings.errors.receivedExceedsAgreed);
      return;
    }
    setBusy(true);
    try {
      const { data } = await apiClient.post<Onboarding & { admin_email: string; admin_temp_password: string }>("/super-admin/onboarding", {
        ...form,
        contact_email: form.contact_email || null,
        agreed_amount: Number(form.agreed_amount),
        amount_received: Number(form.amount_received),
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : null,
        student_limit: Number(form.student_limit),
        staff_limit: Number(form.staff_limit),
        access_duration_days: Number(form.access_duration_days),
        module_ids: [...selectedModules],
      });
      setOnboarding(data);
      setAdminCredential({ email: data.admin_email, password: data.admin_temp_password });
      window.history.replaceState(null, "", `/super-admin/onboarding/${data.id}`);
      setStep(2);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.createDraft));
    } finally {
      setBusy(false);
    }
  }

  async function saveBranding() {
    if (!instituteId) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.put(`/super-admin/institutes/${instituteId}/branding`, {
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
      });
      if (logo) {
        const payload = new FormData();
        payload.append("file", logo);
        await apiClient.post(`/super-admin/institutes/${instituteId}/branding/logo`, payload);
      }
      await loadOnboarding(instituteId);
      setStep(3);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.saveBranding));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!instituteId) return;
    const confirmed = await confirmAction(strings.publishConfirm, {
      title: strings.publishConfirmTitle,
      confirmText: strings.publishConfirmButton,
      variant: "primary",
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const { data } = await apiClient.post<Onboarding>(`/super-admin/onboarding/${instituteId}/publish`);
      setOnboarding(data);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.publish));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-page">
      <PageHeader
        title={onboarding?.name || strings.defaultTitle}
        subtitle={strings.subtitle}
        actions={
          <LinkButton variant="secondary" to="/super-admin/onboarding" leftIcon={<Icon name="arrowLeft" />}>
            {strings.allOnboardings}
          </LinkButton>
        }
      />

      <OnboardingStepper step={step} />

      {error && <p className="error-text">{error}</p>}

      {step === 1 && (
        <Step1AgreementForm
          form={form}
          set={set}
          methods={methods}
          onPaymentMethodChange={(value) => setForm((prev) => ({ ...prev, payment_method_id: value }))}
          modules={modules}
          selectedModules={selectedModules}
          onToggleModule={toggleModule}
          onToggleAllModules={toggleAllModules}
          busy={busy}
          onSubmit={createDraft}
        />
      )}

      {step === 2 && (
        <Step2BrandingForm
          form={form}
          set={set}
          instituteName={onboarding?.name}
          logoSrc={uploadedLogoSrc ?? existingLogoSrc}
          adminCredential={adminCredential}
          onLogoChange={setLogo}
          busy={busy}
          onSave={saveBranding}
        />
      )}

      {step === 3 && onboarding && <Step3PublishSummary onboarding={onboarding} busy={busy} onPublish={publish} />}
    </div>
  );
}
