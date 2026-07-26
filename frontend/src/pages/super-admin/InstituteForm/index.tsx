import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import { BrandingPreview } from "@/pages/super-admin/InstituteBranding/components/BrandingPreview";
import { instituteFormStrings as strings } from "./InstituteForm.strings";
import { DEFAULT_PERMISSIONS, type CreatedInstitute, type InstitutePermissions } from "./types";
import { CreatedInstituteModal } from "./components/CreatedInstituteModal";
import { AdminAccountFields } from "./components/AdminAccountFields";
import { SessionPolicyFieldset } from "./components/SessionPolicyFieldset";
import { PermissionsFieldset } from "./components/PermissionsFieldset";

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

  // Allocation & Limits
  const [studentLimit, setStudentLimit] = useState<number | "">(50);
  const [staffLimit, setStaffLimit] = useState<number | "">(0);
  const [accessDurationDays, setAccessDurationDays] = useState<number | "">(365);
  const [aiMonthlyLimit, setAiMonthlyLimit] = useState<number | "">(0);

  // Courses & Permissions
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [methods, setMethods] = useState<Method[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<number>>(new Set());
  const [permissions, setPermissions] = useState<InstitutePermissions>(DEFAULT_PERMISSIONS);
  const [sessionDurationHours, setSessionDurationHours] = useState(24);

  // Branding
  const [primaryColor, setPrimaryColor] = useState("#e53935");
  const [secondaryColor, setSecondaryColor] = useState("#17191d");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  // Page State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedInstitute | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      apiClient.get<ModuleOption[]>("/super-admin/plans/available-modules"),
      apiClient.get<Method[]>("/super-admin/payment-methods", { params: { active_only: true } }),
    ]).then(([moduleRes, methodRes]) => {
      setModules(moduleRes.data);
      setMethods(methodRes.data);
    });

    if (isNew) return;

    apiClient
      .get(`/super-admin/institutes/${id}`)
      .then(({ data }) => {
        setName(data.name ?? "");
        setContactEmail(data.contact_email ?? "");
        setSessionDurationHours(data.session_duration_hours ?? 24);
        setAiMonthlyLimit(data.ai_monthly_limit ?? 0);
        setPermissions({ ...DEFAULT_PERMISSIONS, ...data.admin_permissions });
        setAgreementReference(data.agreement_reference ?? "");
        setAgreementNotes(data.agreement_notes ?? "");
        setAgreedAmount(data.agreed_amount != null ? Number(data.agreed_amount) : "");
        if (data.amount_received != null) setAmountReceived(data.amount_received);
        if (data.payment_method_id) setPaymentMethodId(String(data.payment_method_id));
        if (data.payment_reference) setPaymentReference(data.payment_reference);
        setCurrency(data.agreement_currency ?? "INR");
        setStudentLimit(data.student_limit ?? 50);
        setStaffLimit(data.staff_limit ?? 0);
        setAccessDurationDays(data.access_duration_days ?? 365);
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

  function validateStep(tab: TabKey): boolean {
    if (tab === "profile") {
      if (!name.trim()) {
        setError("Institute Name is required.");
        return false;
      }
      if (isNew && (!adminEmail.trim() || !adminFirstName.trim())) {
        setError("Admin email and first name are required to create an institute.");
        return false;
      }
    }
    setError(null);
    return true;
  }

  function handleNextStep() {
    if (!validateStep(activeTab)) return;
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
      if (!validateStep(activeTab)) return;
    }
    setError(null);
    setActiveTab(targetTab);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!validateStep("profile")) {
      setActiveTab("profile");
      return;
    }

    setSaving(true);

    const payload: Record<string, unknown> = {
      name,
      session_duration_hours: sessionDurationHours,
      ai_monthly_limit: aiMonthlyLimit === "" ? 0 : Number(aiMonthlyLimit),
      student_limit: studentLimit === "" ? 50 : Number(studentLimit),
      staff_limit: staffLimit === "" ? 0 : Number(staffLimit),
      access_duration_days: accessDurationDays === "" ? 365 : Number(accessDurationDays),
      module_ids: [...selectedModules],
    };

    if (contactEmail.trim()) payload.contact_email = contactEmail.trim();
    if (agreementReference.trim()) payload.agreement_reference = agreementReference.trim();
    if (agreementNotes.trim()) payload.agreement_notes = agreementNotes.trim();
    if (agreedAmount !== "") payload.agreed_amount = Number(agreedAmount);
    if (amountReceived !== "") payload.amount_received = Number(amountReceived);
    if (currency.trim()) payload.currency = currency.trim();
    if (paymentMethodId) payload.payment_method_id = Number(paymentMethodId);
    if (paymentReference.trim()) payload.payment_reference = paymentReference.trim();
    if (primaryColor) payload.primary_color = primaryColor;
    if (secondaryColor) payload.secondary_color = secondaryColor;
    if (permissions) payload.admin_permissions = permissions;

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

        setCreated({ id: data.id, admin_email: data.admin_email, admin_temp_password: data.admin_temp_password });
      } else {
        await apiClient.patch(`/super-admin/institutes/${id}`, payload);

        if (logoFile) {
          const formData = new FormData();
          formData.append("file", logoFile);
          await apiClient.post(`/super-admin/institutes/${id}/branding/logo`, formData);
        }

        navigate("/super-admin/institutes");
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save));
    } finally {
      setSaving(false);
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
    { key: "permissions", step: 4, label: "Permissions & AI Policy" },
    { key: "branding", step: 5, label: "Branding & Preview" },
  ];

  return (
    <div className="institute-form-shell">
      {/* Header Stepper Navigation with Lines & Arrows */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24, overflowX: "auto" }}>
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
                    {isCompleted ? "✓" : tab.step}
                  </span>
                  <span>{tab.label}</span>
                </button>

                {!isLast && (
                  <div style={{ display: "flex", alignItems: "center", margin: "0 6px", color: isCompleted ? "var(--primary, #e11d2e)" : "#cbd5e1" }}>
                    <div style={{ width: 14, height: 2, background: isCompleted ? "var(--primary, #e11d2e)" : "#e2e8f0", borderRadius: 1 }} />
                    <span style={{ fontSize: 12, marginLeft: -2, fontWeight: 700 }}>&rarr;</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!isNew && (
          <Link className="button-link" to={`/super-admin/institutes/${id}/accounts`} style={{ flexShrink: 0 }}>
            {strings.accounts}
          </Link>
        )}
      </div>

      <form className="institute-form-card" onSubmit={handleSubmit}>
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
                <div style={{ padding: 20, borderRadius: 12, background: "var(--surface-muted, #f8fafc)", border: "1px solid var(--border, #e2e8f0)", maxWidth: 600 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted, #64748b)" }}>
                    Admin credentials created during onboarding. To manage or reset user accounts for this institute, visit the <strong>Accounts</strong> sub-page.
                  </p>
                  <Link className="button-link secondary-button" to={`/super-admin/institutes/${id}/accounts`} style={{ marginTop: 12, display: "inline-flex" }}>
                    Manage Accounts
                  </Link>
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
            <div className="form-grid-3col">
              <div>
                <label htmlFor="agreement_reference">Agreement Reference</label>
                <input id="agreement_reference" value={agreementReference} onChange={(e) => setAgreementReference(e.target.value)} placeholder="e.g. AG-2026-081" />
              </div>
              <div>
                <label htmlFor="agreed_amount">Agreed Amount</label>
                <input id="agreed_amount" type="number" min="0" value={agreedAmount} onChange={(e) => setAgreedAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="50000" />
              </div>
              <div>
                <label htmlFor="amount_received">Amount Received</label>
                <input id="amount_received" type="number" min="0" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value === "" ? "" : Number(e.target.value))} placeholder="50000" />
              </div>
              <div>
                <label htmlFor="currency">Currency</label>
                <input id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="INR" />
              </div>
              <div>
                <label htmlFor="payment_method">Payment Method</label>
                <SearchableSelect
                  options={[{ value: "", label: "Manual / Unspecified" }, ...methods.map((m) => ({ value: m.id, label: m.name }))]}
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

            <div className="form-section-header" style={{ marginTop: 32 }}>
              <h2 className="form-section-title">Capacity & Quota Allocations</h2>
              <p className="form-section-subtitle">Define student/staff account limits, contract access duration, and monthly AI grading quota.</p>
            </div>
            <div className="form-grid-4col">
              <div>
                <label htmlFor="student_limit">Student Limit<RequiredMark /></label>
                <input id="student_limit" type="number" min="0" value={studentLimit} onChange={(e) => setStudentLimit(e.target.value === "" ? "" : Number(e.target.value))} required />
              </div>
              <div>
                <label htmlFor="staff_limit">Instructor Limit<RequiredMark /></label>
                <input id="staff_limit" type="number" min="0" value={staffLimit} onChange={(e) => setStaffLimit(e.target.value === "" ? "" : Number(e.target.value))} required />
              </div>
              <div>
                <label htmlFor="access_duration_days">Access Duration (Days)<RequiredMark /></label>
                <input id="access_duration_days" type="number" min="1" value={accessDurationDays} onChange={(e) => setAccessDurationDays(e.target.value === "" ? "" : Number(e.target.value))} required />
              </div>
              <div>
                <label htmlFor="ai-monthly-limit">AI Monthly Evaluation Quota</label>
                <input
                  id="ai-monthly-limit"
                  type="number"
                  min="0"
                  max="100000"
                  value={aiMonthlyLimit}
                  onChange={(e) => setAiMonthlyLimit(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0 (Global default limit)"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Course Allocation */}
        {activeTab === "courses" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 className="form-section-title" style={{ margin: 0 }}>Included Course Modules</h2>
                <p className="form-section-subtitle" style={{ margin: 0 }}>Select course modules bundle included in this institute's agreement.</p>
              </div>
              <button type="button" className="button-link secondary-button" onClick={toggleAllModules} style={{ padding: "6px 16px", fontSize: 12 }}>
                {selectedModules.size === modules.length ? "Deselect All" : "Select All"}
              </button>
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
                      border: isSelected ? "2px solid var(--primary, #e11d2e)" : "1px solid var(--border, rgba(226, 232, 240, 0.9))",
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
                      <span style={{ fontSize: 11.5, color: "var(--text-muted, #64748b)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                        {module.module_type} &middot; {module.duration_minutes} min
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: Permissions & AI Policy */}
        {activeTab === "permissions" && (
          <div>
            <SessionPolicyFieldset sessionDurationHours={sessionDurationHours} onSessionDurationHoursChange={setSessionDurationHours} />

            <fieldset className="permission-fieldset" style={{ marginTop: 24 }}>
              <legend>AI evaluation limit</legend>
              <p className="hint">Custom monthly AI grading quota for this institute. Set to 0 (or leave empty) to use the global default limit.</p>
              <label htmlFor="ai-monthly-limit-perm">Monthly evaluation limit</label>
              <input
                id="ai-monthly-limit-perm"
                type="number"
                min="0"
                max="100000"
                value={aiMonthlyLimit}
                onChange={(event) => setAiMonthlyLimit(event.target.value === "" ? "" : Number(event.target.value))}
                placeholder="0 (Use global limit)"
              />
            </fieldset>

            <PermissionsFieldset permissions={permissions} onPermissionsChange={setPermissions} />
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
        <div className="form-actions" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginTop: 32, paddingTop: 16, borderTop: "1px solid var(--border, #e2e8f0)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {currentTabIndex > 0 && (
              <button type="button" className="button-link secondary-button" onClick={handlePrevStep} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                &larr; Previous Step
              </button>
            )}
            <button type="button" className="button-link secondary-button" onClick={() => navigate("/super-admin/institutes")}>
              {strings.cancel}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {currentTabIndex < TAB_KEYS.length - 1 ? (
              <button
                type="button"
                className="primary-submit-btn"
                onClick={handleNextStep}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                Next Step &rarr;
              </button>
            ) : (
              <button type="submit" disabled={saving} className="primary-submit-btn" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {saving ? strings.saving : isNew ? "Create Institute" : strings.save}
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
          onAddStudents={() => navigate(`/super-admin/institutes/${created.id}/students`)}
          onDone={() => navigate("/super-admin/institutes")}
        />
      )}
    </div>
  );
}
