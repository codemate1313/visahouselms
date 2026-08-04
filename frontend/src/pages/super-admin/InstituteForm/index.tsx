import { type ChangeEvent, type FormEvent, type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, LinkButton, RequiredMark, SearchableSelect } from "@/components/ui";
import { BrandingPreview } from "@/pages/super-admin/InstituteBranding/components/BrandingPreview";
import { useToastStore } from "@/store/toastStore";
import { instituteFormStrings as strings } from "./InstituteForm.strings";
import { EMPTY_ALLOCATION, allocationSummaryLine, type CreatedInstitute } from "./types";
import { CreatedInstituteModal } from "./components/CreatedInstituteModal";
import { AllocationFieldset } from "./components/AllocationFieldset";
import { AdminAccountFields } from "./components/AdminAccountFields";
import { SessionPolicyFieldset } from "./components/SessionPolicyFieldset";
import { Icon } from "@/components/icons";
import { confirmAction } from "@/components/confirmDialog";
import {
  AgreementAttachments,
  type AgreementAttachment,
} from "./components/AgreementAttachments";

interface ModuleOption {
  id: number;
  title: string;
  module_type: string;
  duration_minutes: number;
  created_by_name: string;
}

interface Method {
  id: number;
  name: string;
  is_active: boolean;
}

type TabKey = "profile" | "agreement" | "courses" | "permissions" | "branding";

const TAB_KEYS: TabKey[] = ["profile", "agreement", "courses", "permissions", "branding"];

export function InstituteForm() {
  const { id } = useParams();
  const isNew = id === "new" || id === undefined;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>("profile");

  // Core & Admin Account State
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");

  // Agreement & Financials
  const [agreementReference, setAgreementReference] = useState("");
  const [agreementNotes, setAgreementNotes] = useState("");
  const [agreedAmount, setAgreedAmount] = useState<number | "">("");
  const [amountReceived, setAmountReceived] = useState<number | "">("");
  const [currency, setCurrency] = useState("INR");
  const [paymentMethodId, setPaymentMethodId] = useState<string>("");
  const [paymentReference, setPaymentReference] = useState("");
  const [agreementDocumentFile, setAgreementDocumentFile] = useState<File | null>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [agreementDocument, setAgreementDocument] = useState<AgreementAttachment | null>(null);
  const [paymentProof, setPaymentProof] = useState<AgreementAttachment | null>(null);

  // What the institute is provisioned with. The plan that enforces it is the
  // server's business, so nothing here names or prices one.
  const [allocation, setAllocation] = useState(EMPTY_ALLOCATION);

  // Courses & access policy. Institute admins hold every permission by virtue
  // of the role, so there is nothing to pick here.
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<number>>(new Set());
  const [sessionDurationHours, setSessionDurationHours] = useState(24);

  // Branding
  const [primaryColor, setPrimaryColor] = useState("#e53935");
  const [secondaryColor, setSecondaryColor] = useState("#17191d");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  // Plans & package selections
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  // Page State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedInstitute | null>(null);
  const [copied, setCopied] = useState(false);
  const showSuccess = useToastStore((state) => state.showSuccess);

  useEffect(() => {
    Promise.all([
      apiClient.get<ModuleOption[]>("/super-admin/plans/available-modules"),
      apiClient.get<Method[]>("/super-admin/payment-methods", { params: { active_only: true } }),
      apiClient.get<any[]>("/super-admin/plans", { params: { audience: "institutes" } }),
    ]).then(([moduleRes, methodRes, plansRes]) => {
      setModules(moduleRes.data);
      setMethods(methodRes.data);
      setPlans(plansRes.data);
    });

    if (isNew) return;

    apiClient
      .get(`/super-admin/institutes/${id}`)
      .then(({ data }) => {
        setName(data.name ?? "");
        setContactEmail(data.contact_email ?? "");
        setSessionDurationHours(data.session_duration_hours ?? 24);
        setAgreementReference(data.agreement_reference ?? "");
        setAgreementNotes(data.agreement_notes ?? "");
        setAgreedAmount(data.agreed_amount != null ? Number(data.agreed_amount) : "");
        if (data.amount_received != null) setAmountReceived(data.amount_received);
        if (data.payment_method_id) setPaymentMethodId(String(data.payment_method_id));
        if (data.payment_reference) setPaymentReference(data.payment_reference);
        setAgreementDocument(data.agreement_document ?? null);
        setPaymentProof(data.payment_proof ?? null);
        setCurrency(data.agreement_currency ?? "INR");
        setAllocation({
          student_limit: String(data.student_limit ?? 50),
          staff_limit: String(data.staff_limit ?? 0),
          access_duration_days: String(data.access_duration_days ?? 365),
          grace_days: String(data.grace_days ?? 0),
        });
        if (data.module_ids) setSelectedModules(new Set(data.module_ids));
        if (data.branding) {
          setPrimaryColor(data.branding.primary_color ?? "#e53935");
          setSecondaryColor(data.branding.secondary_color ?? "#17191d");
          if (data.branding.logo_url) setExistingLogoUrl(data.branding.logo_url);
        }
      })
      .catch(() => setError(strings.errors.load))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const logoPreviewSrc = useMemo(() => {
    if (logoFile) return URL.createObjectURL(logoFile);
    if (existingLogoUrl) return `${API_BASE_URL}${existingLogoUrl}`;
    return null;
  }, [logoFile, existingLogoUrl]);

  const currentTabIndex = TAB_KEYS.indexOf(activeTab);

  function toggleModule(moduleId: number) {
    setSelectedModules((curr) => {
      const next = new Set(curr);
      if (next.has(moduleId)) next.delete(moduleId); else next.add(moduleId);
      return next;
    });
  }

  function toggleAllModules() {
    setSelectedModules((curr) => (curr.size === modules.length ? new Set() : new Set(modules.map((m) => m.id))));
  }

  function updateAllocation(field: keyof typeof EMPTY_ALLOCATION, value: string) {
    setAllocation((curr) => ({ ...curr, [field]: value }));
  }

  function validateStep(tab: TabKey): boolean {
    if (tab === "profile") {
      if (!name.trim()) {
        setError("Institute Name is required.");
        return false;
      }
      if (isNew && (!adminEmail.trim() || !adminFirstName.trim() || !adminLastName.trim())) {
        setError("Admin email, first name, and last name are required to create an institute.");
        return false;
      }
    }
    if (tab === "agreement") {
      // The commercial terms are what the institute is provisioned against, so
      // none of them are optional - an agreement with no reference or no money
      // recorded cannot be reconciled later.
      if (!agreementReference.trim()) {
        setError("Agreement Reference is required.");
        return false;
      }
      if (agreedAmount === "") {
        setError("Agreed Amount is required.");
        return false;
      }
      if (amountReceived === "") {
        setError("Amount Received is required.");
        return false;
      }
      if (Number(amountReceived) > Number(agreedAmount)) {
        setError("Amount Received cannot exceed the Agreed Amount.");
        return false;
      }
      if (!currency.trim()) {
        setError("Currency is required.");
        return false;
      }
      if (!paymentMethodId) {
        setError("Payment Method is required.");
        return false;
      }
      if (!allocation.access_duration_days || Number(allocation.access_duration_days) < 1) {
        setError("Access duration must be at least 1 day.");
        return false;
      }
    }
    if (tab === "courses" && selectedModules.size === 0) {
      setError("Select at least one course for this institute.");
      return false;
    }
    setError(null);
    return true;
  }

  /** Creating walks the steps in order, so each one is gated on being valid.
   *  Editing is not a walk: the steps are tabs into an institute that already
   *  exists, and gating them would strand an older record - one saved before
   *  the agreement fields were mandatory - on the step holding the blank. The
   *  rules are not waived, just moved: handleSubmit checks every step and
   *  opens the offending one. */
  function canLeaveStep() {
    if (isNew) return validateStep(activeTab);
    setError(null);
    return true;
  }

  function handleNextStep() {
    if (!canLeaveStep()) return;
    if (currentTabIndex < TAB_KEYS.length - 1) {
      setActiveTab(TAB_KEYS[currentTabIndex + 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handlePrevStep() {
    if (currentTabIndex > 0) {
      setError(null);
      setActiveTab(TAB_KEYS[currentTabIndex - 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function handleTabClick(targetTab: TabKey) {
    const targetIdx = TAB_KEYS.indexOf(targetTab);
    if (targetIdx > currentTabIndex) {
      if (!canLeaveStep()) return;
    }
    setError(null);
    setActiveTab(targetTab);
  }

  function handleSubmit(event: FormEvent) {
    // Nothing in this form is type="submit" any more (see the actions bar), so
    // this only ever runs if a browser finds some other route to submitting.
    event.preventDefault();
    void save();
  }

  function blockImplicitSubmit(event: KeyboardEvent<HTMLFormElement>) {
    // Every field sits in one <form>, so Enter in any of them would submit it -
    // saving from whichever step is open and leaving the later ones unseen.
    // Saving is an explicit button press; multi-line notes keep their newlines.
    const target = event.target as HTMLElement;
    if (event.key === "Enter" && target.tagName !== "TEXTAREA") {
      event.preventDefault();
    }
  }

  async function save() {
    setError(null);

    if (!validateStep("profile")) {
      setActiveTab("profile");
      return;
    }
    if (!validateStep("agreement")) {
      setActiveTab("agreement");
      return;
    }
    if (!validateStep("courses")) {
      setActiveTab("courses");
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      name,
      session_duration_hours: sessionDurationHours,
      student_limit: Number(allocation.student_limit || 0),
      staff_limit: Number(allocation.staff_limit || 0),
      access_duration_days: Number(allocation.access_duration_days || 365),
      grace_days: Number(allocation.grace_days || 0),
      module_ids: [...selectedModules],
    };

    payload.agreement_reference = agreementReference.trim();
    payload.agreed_amount = Number(agreedAmount);
    payload.amount_received = Number(amountReceived);
    payload.currency = currency.trim();
    payload.payment_method_id = Number(paymentMethodId);
    if (contactEmail.trim()) payload.contact_email = contactEmail.trim();
    if (agreementNotes.trim()) payload.agreement_notes = agreementNotes.trim();
    if (paymentReference.trim()) payload.payment_reference = paymentReference.trim();
    if (primaryColor) payload.primary_color = primaryColor;
    if (secondaryColor) payload.secondary_color = secondaryColor;

    try {
      if (isNew) {
        payload.admin_email = adminEmail;
        payload.admin_first_name = adminFirstName;
        payload.admin_last_name = adminLastName;

        const { data } = await apiClient.post("/super-admin/institutes", payload);
        const instituteId = data.id;

        if (logoFile) {
          const formData = new FormData();
          formData.append("file", logoFile);
          await apiClient.post(`/super-admin/institutes/${instituteId}/branding/logo`, formData);
        }
        await uploadAgreementAttachments(instituteId);

        setCreated({ id: data.id, admin_email: data.admin_email, admin_temp_password: data.admin_temp_password });
        // Confirm what the institute was provisioned with, now that onboarding
        // is done - the form itself no longer restates it.
        showSuccess(
          allocationSummaryLine({
            student_limit: Number(allocation.student_limit || 0),
            staff_limit: Number(allocation.staff_limit || 0),
            duration_days: Number(allocation.access_duration_days || 0),
            module_count: selectedModules.size,
          }),
          strings.createdModal.allocationToastTitle,
        );
      } else {
        await apiClient.patch(`/super-admin/institutes/${id}`, payload);

        if (logoFile) {
          const formData = new FormData();
          formData.append("file", logoFile);
          await apiClient.post(`/super-admin/institutes/${id}/branding/logo`, formData);
        }
        await uploadAgreementAttachments(Number(id));

        // Saving is done with the institute, whichever step it was pressed
        // from - the steps are there to reach a field, not to be walked.
        showSuccess(strings.wizard.savedToast);
        navigate("/super-admin/institutes");
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save));
    } finally {
      setSaving(false);
    }
  }

  async function uploadAgreementAttachments(instituteId: number) {
    const uploads: Promise<unknown>[] = [];
    if (agreementDocumentFile) {
      const formData = new FormData();
      formData.append("file", agreementDocumentFile);
      uploads.push(apiClient.post(
        `/super-admin/institutes/${instituteId}/documents/agreement`,
        formData,
      ));
    }
    if (paymentProofFile) {
      const formData = new FormData();
      formData.append("file", paymentProofFile);
      uploads.push(apiClient.post(
        `/super-admin/institutes/${instituteId}/documents/payment-proof`,
        formData,
      ));
    }
    await Promise.all(uploads);
  }

  async function downloadAttachment(attachment: AgreementAttachment) {
    try {
      const { data } = await apiClient.get<Blob>(attachment.download_url, {
        responseType: "blob",
      });
      const objectUrl = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to download attachment."));
    }
  }

  async function removeAttachment(kind: "agreement" | "payment-proof") {
    if (isNew || !id) return;
    const confirmed = await confirmAction("Remove this attachment permanently?", {
      title: "Remove attachment",
      confirmText: "Remove",
      variant: "warning",
    });
    if (!confirmed) return;
    try {
      await apiClient.delete(`/super-admin/institutes/${id}/documents/${kind}`);
      if (kind === "agreement") setAgreementDocument(null);
      else setPaymentProof(null);
      showSuccess("Attachment removed.", "Agreement updated");
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to remove attachment."));
    }
  }

  async function copyPassword() {
    if (!created) return;
    await navigator.clipboard.writeText(created.admin_temp_password);
    setCopied(true);
  }

  if (loading) return <p style={{ padding: 24 }}>{strings.loading}</p>;

  const stepsDef: { key: TabKey; step: number; label: string }[] = [
    { key: "profile", step: 1, label: "Profile & Admin" },
    { key: "agreement", step: 2, label: "Agreement & Quotas" },
    { key: "courses", step: 3, label: `Courses (${selectedModules.size})` },
    { key: "permissions", step: 4, label: "Access Policy" },
    { key: "branding", step: 5, label: "Branding & Preview" },
  ];

  return (
    <div className="institute-form-shell">
      <div className="stepper-navigation-header">
        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
          {stepsDef.map((tab, idx) => {
            const isActive = activeTab === tab.key;
            const isCompleted = currentTabIndex > idx;
            const isLast = idx === stepsDef.length - 1;

            return (
              <div key={tab.key} style={{ display: "flex", alignItems: "center" }}>
                <button
                  type="button"
                  className={`institute-tab-btn ${isActive ? "is-active" : ""}`}
                  onClick={() => handleTabClick(tab.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderRadius: "24px",
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 500,
                    border: isActive
                      ? "1px solid var(--primary, #e11d2e)"
                      : isCompleted
                      ? "1px solid rgba(225, 29, 46, 0.3)"
                      : "1px solid var(--border, #e2e8f0)",
                    background: isActive
                      ? "var(--primary, #e11d2e)"
                      : isCompleted
                      ? "rgba(225, 29, 46, 0.08)"
                      : "var(--surface, #ffffff)",
                    color: isActive
                      ? "#ffffff"
                      : isCompleted
                      ? "var(--primary, #e11d2e)"
                      : "var(--text-muted, #64748b)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: isActive ? "0 2px 8px rgba(225, 29, 46, 0.25)" : "none",
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      background: isActive
                        ? "#ffffff"
                        : isCompleted
                        ? "var(--primary, #e11d2e)"
                        : "rgba(100, 116, 139, 0.15)",
                      color: isActive
                        ? "var(--primary, #e11d2e)"
                        : isCompleted
                        ? "#ffffff"
                        : "var(--text-muted, #64748b)",
                    }}
                  >
                    {isCompleted ? <Icon name="check" /> : tab.step}
                  </span>
                  <span>{tab.label}</span>
                </button>

                {!isLast && (
                  <div style={{ display: "flex", alignItems: "center", margin: "0 6px", color: isCompleted ? "var(--primary, var(--red-500))" : "var(--border)" }}>
                    <div style={{ width: 14, height: 2, background: isCompleted ? "var(--primary, var(--red-500))" : "var(--border)", borderRadius: 1 }} />
                    <Icon name="arrowRight" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!isNew && (
          <LinkButton to={`/super-admin/institutes/${id}/accounts`} style={{ flexShrink: 0 }}>
            {strings.accounts}
          </LinkButton>
        )}
      </div>

      <form className="institute-form-card" onSubmit={handleSubmit} onKeyDown={blockImplicitSubmit}>
        {/* TAB 1: Profile & Admin */}
        {activeTab === "profile" && (
          <div>
            <div className="form-section-header">
              <h2 className="form-section-title">Institute Profile</h2>
              <p className="form-section-subtitle">Basic partner organization details and contact email.</p>
            </div>
            <div className="form-grid-2col" style={{ marginBottom: 28 }}>
              <div>
                <label htmlFor="name">{strings.nameLabel}<RequiredMark /></label>
                <input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Visa House IELTS Academy" />
              </div>
              <div>
                <label htmlFor="contact_email">{strings.contactEmailLabel}</label>
                <input id="contact_email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder={strings.contactEmailPlaceholder} />
              </div>
            </div>

            {isNew ? (
              <AdminAccountFields
                adminEmail={adminEmail}
                onAdminEmailChange={setAdminEmail}
                adminFirstName={adminFirstName}
                onAdminFirstNameChange={setAdminFirstName}
                adminLastName={adminLastName}
                onAdminLastNameChange={setAdminLastName}
              />
            ) : (
              <div>
                <div className="form-section-header" style={{ marginTop: 24 }}>
                  <h2 className="form-section-title">Admin Account Credentials</h2>
                  <p className="form-section-subtitle">Super-admin account for managing this institute.</p>
                </div>
                <div style={{ padding: 20, borderRadius: 12, background: "var(--surface-muted, #f8fafc)", border: "1px solid var(--border, var(--border))", maxWidth: 600 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted, var(--slate-500))" }}>
                    Admin credentials created during onboarding. To manage or reset user accounts for this institute, visit the <strong>Accounts</strong> sub-page.
                  </p>
                  <LinkButton variant="secondary" to={`/super-admin/institutes/${id}/accounts`} style={{ marginTop: 12 }}>
                    {strings.wizard.manageAccounts}
                  </LinkButton>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Agreement & Quotas */}
        {activeTab === "agreement" && (
          <div>
            <div className="form-section-header">
              <h2 className="form-section-title">Commercial Agreement</h2>
              <p className="form-section-subtitle">Contract references, financial transaction amounts, and payment tracking.</p>
            </div>

            <div style={{ marginBottom: 24, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20, alignItems: "center", background: "var(--surface-muted)", padding: "16px 20px", borderRadius: 12, border: "1px solid var(--border)" }}>
              <div>
                <label htmlFor="package_select" style={{ fontWeight: 700, margin: 0, display: "block" }}>Select Package / Plan</label>
                <span className="hint" style={{ fontSize: 12, display: "block", marginTop: 2, color: "var(--text-muted)" }}>Optionally choose a plan to auto-fill limits and pricing. You can still modify fields manually afterwards.</span>
              </div>
              <div>
                <SearchableSelect
                  options={[
                    { value: "", label: "Custom / No Package" },
                    ...plans.map((p) => ({
                      value: String(p.id),
                      label: `${p.name} (${p.student_limit} students, ${p.staff_limit} instructors) - ${p.price} ${p.currency}`
                    }))
                  ]}
                  placeholder="Choose an institute plan..."
                  value={selectedPlanId}
                  onChange={(val) => {
                    const idStr = String(val);
                    setSelectedPlanId(idStr);
                    if (idStr) {
                      const found = plans.find((p) => String(p.id) === idStr);
                      if (found) {
                        setAgreedAmount(found.price != null ? Number(found.price) : "");
                        setCurrency(found.currency ?? "INR");
                        setAllocation({
                          student_limit: String(found.student_limit ?? 50),
                          staff_limit: String(found.staff_limit ?? 0),
                          access_duration_days: String(found.duration_days ?? 365),
                          grace_days: String(found.grace_days ?? 7),
                        });
                      }
                    }
                  }}
                  searchable={true}
                  className="form-dropdown-select"
                />
              </div>
            </div>

            <div className="form-grid-3col">
              <div>
                <label htmlFor="agreement_reference">Agreement Reference<RequiredMark /></label>
                <input id="agreement_reference" value={agreementReference} onChange={(e) => setAgreementReference(e.target.value)} placeholder="e.g. AG-2026-081" />
              </div>
              <div>
                <label htmlFor="agreed_amount">Agreed Amount<RequiredMark /></label>
                <input id="agreed_amount" type="number" min="0" value={agreedAmount} onChange={(e) => setAgreedAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="50000" />
              </div>
              <div>
                <label htmlFor="amount_received">Amount Received<RequiredMark /></label>
                <input id="amount_received" type="number" min="0" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value === "" ? "" : Number(e.target.value))} placeholder="50000" />
              </div>
              <div>
                <label htmlFor="currency">Currency<RequiredMark /></label>
                <input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="INR" />
              </div>
              <div>
                <label htmlFor="payment_method">Payment Method<RequiredMark /></label>
                <SearchableSelect
                  options={methods.map((m) => ({ value: m.id, label: m.name }))}
                  placeholder="Select payment method..."
                  value={paymentMethodId}
                  onChange={(val) => setPaymentMethodId(String(val))}
                  searchable={false}
                  className="form-dropdown-select"
                />
              </div>
              <div>
                <label htmlFor="payment_reference">Receipt Reference</label>
                <input id="payment_reference" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Txn / Bank Ref" />
              </div>
            </div>

            <div style={{ marginTop: 20, marginBottom: 28 }}>
              <label htmlFor="agreement_notes">Agreement Notes</label>
              <textarea id="agreement_notes" rows={2} value={agreementNotes} onChange={(e) => setAgreementNotes(e.target.value)} placeholder="Additional contract terms or special conditions..." />
            </div>

            <AgreementAttachments
              agreementDocument={agreementDocument}
              agreementDocumentFile={agreementDocumentFile}
              paymentProof={paymentProof}
              paymentProofFile={paymentProofFile}
              onAgreementDocumentChange={setAgreementDocumentFile}
              onPaymentProofChange={setPaymentProofFile}
              onDownload={(attachment) => void downloadAttachment(attachment)}
              onRemoveAgreementDocument={() => void removeAttachment("agreement")}
              onRemovePaymentProof={() => void removeAttachment("payment-proof")}
            />

            <AllocationFieldset allocation={allocation} onChange={updateAllocation} />
          </div>
        )}

        {/* TAB 3: Course Allocation */}
        {activeTab === "courses" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 className="form-section-title" style={{ margin: 0 }}>Included Course Modules</h2>
                <p className="form-section-subtitle" style={{ margin: 0 }}>
                  Select the course modules included in this institute's agreement.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={toggleAllModules}>
                {selectedModules.size === modules.length ? strings.wizard.deselectAllModules : strings.wizard.selectAllModules}
              </Button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
              {modules.map((module) => {
                const isSelected = selectedModules.has(module.id);
                return (
                  <div
                    key={module.id}
                    onClick={() => toggleModule(module.id)}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      border: isSelected ? "2px solid var(--primary, var(--red-500))" : "1px solid var(--border, rgba(226, 232, 240, 0.9))",
                      background: isSelected ? "rgba(225, 29, 46, 0.04)" : "var(--surface)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <input type="checkbox" checked={isSelected} readOnly style={{ marginTop: 3, cursor: "pointer" }} />
                    <div>
                      <strong style={{ fontSize: 13.5, display: "block", color: "var(--text)" }}>{module.title}</strong>
                      <span style={{ fontSize: 11.5, color: "var(--text-muted, var(--slate-500))", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {module.module_type} &middot; {module.duration_minutes} min
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: Access Policy */}
        {activeTab === "permissions" && (
          <div>
            <SessionPolicyFieldset sessionDurationHours={sessionDurationHours} onSessionDurationHoursChange={setSessionDurationHours} />
          </div>
        )}

        {/* TAB 5: Branding & Live Preview */}
        {activeTab === "branding" && (
          <div>
            <div className="form-section-header">
              <h2 className="form-section-title">Branding Colors & Logo</h2>
              <p className="form-section-subtitle">Configure custom institute brand identity for student portal themes.</p>
            </div>
            <div className="form-grid-2col" style={{ marginBottom: 24 }}>
              <div>
                <label>Primary Color</label>
                <div className="color-input-row">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                  <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#e53935" />
                </div>
              </div>
              <div>
                <label>Secondary Color</label>
                <div className="color-input-row">
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                  <input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="#17191d" />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <label>Institute Logo</label>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e: ChangeEvent<HTMLInputElement>) => setLogoFile(e.target.files?.[0] || null)} />
            </div>

            <div className="form-section-header" style={{ marginTop: 32, marginBottom: 16 }}>
              <h3 className="form-section-title">Live Student Portal Preview</h3>
              <p className="form-section-subtitle">Real-time preview of how students will see the institute portal theme.</p>
            </div>
            <BrandingPreview
              primary={primaryColor}
              secondary={secondaryColor}
              fontFamily="system-ui"
              headingWeight={700}
              bodyWeight={400}
              logoSrc={logoPreviewSrc}
              instituteName={name || "Sample Institute"}
            />
          </div>
        )}

        {error && <p className="error-text" style={{ marginTop: 24 }}>{error}</p>}

        {/* Form Actions with Next / Previous step controls */}
        <div className="form-actions" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--border, var(--border))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {currentTabIndex > 0 && (
              <Button variant="secondary" leftIcon={<Icon name="arrowLeft" />} onClick={handlePrevStep}>
                {strings.wizard.previousStep}
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate("/super-admin/institutes")}>
              {strings.cancel}
            </Button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Creating walks the steps in order; editing does not. An edit is
                usually one field on one step, so Save is on every step and
                validates the whole form regardless of where it is pressed. */}
            {/* On the last step the primary button is already Save. */}
            {!isNew && currentTabIndex < TAB_KEYS.length - 1 && (
              <Button variant="secondary" disabled={saving} onClick={() => void save()}>
                {saving ? strings.saving : strings.save}
              </Button>
            )}
            {/* Distinct keys, and neither is type="submit". React flushes a
                click synchronously, so a single node that switched from
                "button" to "submit" mid-click would still be a submit button
                by the time the browser ran the click's default action - which
                submitted the form on the way into the last step and skipped
                it. Separate nodes, explicit handlers, no default action. */}
            {currentTabIndex < TAB_KEYS.length - 1 ? (
              <button
                key="next-step"
                type="button"
                className="primary-submit-btn"
                onClick={handleNextStep}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {strings.wizard.nextStep} <Icon name="arrowRight" />
              </button>
            ) : (
              <button
                key="save"
                type="button"
                disabled={saving}
                className="primary-submit-btn"
                onClick={() => void save()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {saving ? strings.saving : isNew ? strings.wizard.createInstitute : strings.save}
              </button>
            )}
          </div>
        </div>
      </form>

      {created && (
        <CreatedInstituteModal
          created={created}
          copied={copied}
          onCopyPassword={copyPassword}
          onDone={() => navigate("/super-admin/institutes")}
        />
      )}
    </div>
  );
}
