import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { SearchableSelect } from "../../components/SearchableSelect";

interface ModuleOption { id: number; title: string; module_type: string; duration_minutes: number; created_by_name: string }
interface Method { id: number; name: string; is_active: boolean }
interface Onboarding {
  id: number;
  name: string;
  onboarding_status: "draft" | "published";
  agreed_amount: string;
  agreement_currency: string;
  student_limit: number;
  staff_limit: number;
  access_duration_days: number;
  course_count: number;
  module_ids: number[];
  admin_permissions: Record<string, boolean>;
  branding: { primary_color: string; secondary_color: string };
  payment: { amount_paid: string; status: string } | null;
  admin_email?: string;
  admin_temp_password?: string;
}

const PERMISSIONS = [
  { key: "view_students", label: "View students", description: "See the institute student directory." },
  { key: "manage_students", label: "Issue and manage students", description: "Create, import, edit, activate, and delete student accounts." },
  { key: "view_student_activity", label: "View student activity", description: "Review attempts, grading history, and known devices." },
  { key: "manage_student_sessions", label: "Manage student sessions", description: "Revoke active student login sessions." },
  { key: "manage_staff", label: "Manage instructors", description: "Create and manage institute instructors." },
  { key: "view_billing", label: "View agreement", description: "See access dates, allocation, and payment history." },
] as const;

const INITIAL_PERMISSIONS = Object.fromEntries(PERMISSIONS.map(({ key }) => [key, true])) as Record<string, boolean>;
const INITIAL = {
  name: "", contact_email: "", admin_email: "", admin_first_name: "", admin_last_name: "",
  agreement_reference: "", agreement_notes: "", agreed_amount: "", amount_received: "", currency: "INR",
  payment_method_id: "", payment_reference: "", student_limit: "50", staff_limit: "0",
  access_duration_days: "365", primary_color: "#e53935", secondary_color: "#17191d",
};

export function InstituteOnboarding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(id ? 2 : 1);
  const [form, setForm] = useState(INITIAL);
  const [adminPermissions, setAdminPermissions] = useState(INITIAL_PERMISSIONS);
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
    setAdminPermissions(record.admin_permissions || INITIAL_PERMISSIONS);
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
    if (id) loadOnboarding(Number(id)).catch(() => setError("Failed to load onboarding."));
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

  async function createDraft(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
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
        admin_permissions: adminPermissions,
      });
      setOnboarding(data);
      setAdminCredential({ email: data.admin_email, password: data.admin_temp_password });
      window.history.replaceState(null, "", `/super-admin/onboarding/${data.id}`);
      setStep(2);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to create onboarding draft."));
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
      setError(extractErrorMessage(err, "Failed to save branding."));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!instituteId || !window.confirm("Publish this institute and activate its administrator account?")) return;
    setBusy(true);
    try {
      const { data } = await apiClient.post<Onboarding>(`/super-admin/onboarding/${instituteId}/publish`);
      setOnboarding(data);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to publish institute."));
    } finally {
      setBusy(false);
    }
  }

  const steps = ["Agreement", "Branding", "Publish"];
  return (
    <div className="onboarding-page">
      <div className="page-header">
        <div>
          <h1>{onboarding?.name || "Onboard Institute"}</h1>
          <p className="page-subtitle">Record the agreement, configure access and branding, then publish the institute.</p>
        </div>
        <Link to="/super-admin/onboarding" className="button-link secondary-link-btn">
          ← All onboardings
        </Link>
      </div>

      <div className="onboarding-stepper-card">
        <ol className="onboarding-steps">
          {steps.map((label, index) => (
            <li className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""} key={label}>
              <span>{step > index + 1 ? "✓" : index + 1}</span>
              <span className="step-label-text">{label}</span>
            </li>
          ))}
        </ol>
      </div>

      {error && <p className="error-text">{error}</p>}

      {step === 1 && (
        <form className="onboarding-split-form" onSubmit={createDraft}>
          <div className="onboarding-grid-two-col">
            {/* LEFT COLUMN */}
            <div className="onboarding-col">
              <CollapsiblePanel
                className="form-card onboarding-section-card"
                title="Institute & Admin Details"
                description="Basic institute credentials and initial admin profile."
              >
                <div className="form-grid">
                  <div>
                    <label htmlFor="ob-name">Institute name</label>
                    <input id="ob-name" value={form.name} onChange={set("name")} required placeholder="e.g. Cambridge Academy" />
                  </div>
                  <div>
                    <label htmlFor="ob-contact">Contact email</label>
                    <input id="ob-contact" type="email" value={form.contact_email} onChange={set("contact_email")} placeholder="contact@institute.com" />
                  </div>
                </div>

                <h3 className="section-subheading" style={{ marginTop: 20 }}>First Institute Administrator</h3>
                <div className="form-grid">
                  <div>
                    <label>Admin email</label>
                    <input type="email" value={form.admin_email} onChange={set("admin_email")} required placeholder="admin@institute.com" />
                  </div>
                  <div>
                    <label>First name</label>
                    <input value={form.admin_first_name} onChange={set("admin_first_name")} required placeholder="John" />
                  </div>
                  <div>
                    <label>Last name</label>
                    <input value={form.admin_last_name} onChange={set("admin_last_name")} required placeholder="Doe" />
                  </div>
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                className="form-card onboarding-section-card"
                title="Administrator Permissions"
                description="Select features enabled for this institute's admin role."
                badge={<span className="count-chip">{Object.values(adminPermissions).filter(Boolean).length}</span>}
              >
                <div className="permission-grid">
                  {PERMISSIONS.map((permission) => (
                    <label className="permission-option" key={permission.key}>
                      <input
                        type="checkbox"
                        checked={Boolean(adminPermissions[permission.key])}
                        onChange={(event) =>
                          setAdminPermissions((current) => ({ ...current, [permission.key]: event.target.checked }))
                        }
                      />
                      <span>
                        <strong>{permission.label}</strong>
                        <small>{permission.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </CollapsiblePanel>
            </div>

            {/* RIGHT COLUMN */}
            <div className="onboarding-col">
              <CollapsiblePanel
                className="form-card onboarding-section-card"
                title="Agreement & Payment Terms"
                description="Commercial terms, payment record, and access allocation."
              >
                <div className="form-grid">
                  <div>
                    <label>Agreed amount</label>
                    <input type="number" min="1" value={form.agreed_amount} onChange={set("agreed_amount")} required placeholder="10000" />
                  </div>
                  <div>
                    <label>Amount received</label>
                    <input type="number" min="1" value={form.amount_received} onChange={set("amount_received")} required placeholder="10000" />
                  </div>
                  <div>
                    <label>Currency</label>
                    <input value={form.currency} onChange={set("currency")} required />
                  </div>
                  <div>
                    <label>Payment method</label>
                    <SearchableSelect
                      options={[{ value: "", label: "Manual / unspecified" }, ...methods.map((method) => ({ value: method.id, label: method.name }))]}
                      value={form.payment_method_id}
                      onChange={(value) => setForm((prev) => ({ ...prev, payment_method_id: String(value) }))}
                      searchPlaceholder="Search payment methods..."
                      className="form-dropdown-select"
                    />
                  </div>
                  <div>
                    <label>Receipt/reference</label>
                    <input value={form.payment_reference} onChange={set("payment_reference")} placeholder="REC-1002" />
                  </div>
                  <div>
                    <label>Agreement reference</label>
                    <input value={form.agreement_reference} onChange={set("agreement_reference")} placeholder="AGR-2026-01" />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <label>Agreement notes</label>
                  <textarea rows={2} value={form.agreement_notes} onChange={set("agreement_notes")} placeholder="Additional notes..." />
                </div>

                <h3 className="section-subheading" style={{ marginTop: 20 }}>Allocation Limits</h3>
                <div className="form-grid">
                  <div>
                    <label>Student limit</label>
                    <input type="number" min="0" value={form.student_limit} onChange={set("student_limit")} required />
                  </div>
                  <div>
                    <label>Instructor limit</label>
                    <input type="number" min="0" value={form.staff_limit} onChange={set("staff_limit")} required />
                  </div>
                  <div>
                    <label>Duration (days)</label>
                    <input type="number" min="1" value={form.access_duration_days} onChange={set("access_duration_days")} required />
                  </div>
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                className="form-card onboarding-section-card"
                title="Included Courses"
                description="Select courses included in this onboarding agreement."
                badge={<span className="count-chip">{selectedModules.size}</span>}
              >
                <div className="plan-course-picker">
                  {modules.map((module) => (
                    <label className="plan-course-option" key={module.id}>
                      <input
                        type="checkbox"
                        checked={selectedModules.has(module.id)}
                        onChange={() => toggleModule(module.id)}
                      />
                      <span>
                        <strong>{module.title}</strong>
                        <small>
                          {module.module_type.replace("_", " ")} · {module.duration_minutes} mins
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              </CollapsiblePanel>
            </div>
          </div>

          <div className="onboarding-form-submit-bar">
            <button type="submit" disabled={busy || !selectedModules.size} className="primary-submit-btn">
              {busy ? "Creating draft..." : "Create draft and continue →"}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <CollapsiblePanel
          className="form-card wide"
          title="Institute branding"
          description="The portal stays offline while you prepare its identity."
        >
          {adminCredential && <section className="credential-sheet"><h3>Institute admin credentials</h3><p>Share these securely. The temporary password is shown only in this session.</p><div className="credential-row"><code>{adminCredential.email}</code><code>{adminCredential.password}</code></div></section>}
          <div className="form-grid"><div><label>Primary color</label><div className="color-input-row"><input type="color" value={form.primary_color} onChange={set("primary_color")} /><input value={form.primary_color} onChange={set("primary_color")} /></div></div><div><label>Secondary color</label><div className="color-input-row"><input type="color" value={form.secondary_color} onChange={set("secondary_color")} /><input value={form.secondary_color} onChange={set("secondary_color")} /></div></div></div>
          <label>Institute logo</label><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setLogo(event.target.files?.[0] || null)} />
          <div className="branding-preview onboarding-brand-preview" style={{ background: form.secondary_color, borderColor: form.primary_color }}><strong style={{ color: form.primary_color }}>{onboarding?.name}</strong><span>Institute Portal</span></div>
          <div className="form-actions"><button onClick={saveBranding} disabled={busy}>{busy ? "Saving..." : "Save branding and review"}</button></div>
        </CollapsiblePanel>
      )}

      {step === 3 && onboarding && (
        <CollapsiblePanel
          className="form-card wide publish-summary-card"
          title={onboarding.onboarding_status === "published" ? "Institute is live" : "Ready to publish"}
          description={`${onboarding.agreement_currency || "INR"} ${Number(onboarding.agreed_amount || 0).toLocaleString("en-IN")} agreement · ${onboarding.payment?.status || "pending"} payment · ${onboarding.access_duration_days} days validity`}
          badge={<span className={`badge ${onboarding.onboarding_status === "published" ? "badge-green" : "badge-amber"}`}>{onboarding.onboarding_status === "published" ? "Published & Live" : "Draft Ready"}</span>}
        >
          <div className="publish-hero-header">
            <span className={`badge ${onboarding.onboarding_status === "published" ? "badge-green" : "badge-amber"}`}>
              {onboarding.onboarding_status === "published" ? "Published & Live" : "Draft Ready"}
            </span>
            <h2 className="publish-hero-title">
              {onboarding.onboarding_status === "published" ? "Institute is live" : "Ready to publish"}
            </h2>
            <p className="publish-hero-subtitle">
              <strong>{onboarding.agreement_currency || "INR"} {Number(onboarding.agreed_amount || 0).toLocaleString("en-IN")}</strong> agreement · 
              <span className="capitalize-text"> {onboarding.payment?.status || "pending"}</span> payment · 
              <strong> {onboarding.access_duration_days} days</strong> validity
            </p>
          </div>

          <div className="publish-stats-grid">
            <div className="publish-stat-box">
              <span className="stat-label">Student Allocation</span>
              <span className="stat-value">{onboarding.student_limit}</span>
            </div>
            <div className="publish-stat-box">
              <span className="stat-label">Instructor Allocation</span>
              <span className="stat-value">{onboarding.staff_limit}</span>
            </div>
            <div className="publish-stat-box">
              <span className="stat-label">Assigned Tests</span>
              <span className="stat-value">Unlimited</span>
            </div>
            <div className="publish-stat-box">
              <span className="stat-label">Included Courses</span>
              <span className="stat-value">{onboarding.course_count}</span>
            </div>
            <div className="publish-stat-box">
              <span className="stat-label">Admin Permissions</span>
              <span className="stat-value">
                {Object.values(onboarding.admin_permissions || {}).filter(Boolean).length} enabled
              </span>
            </div>
            <div className="publish-stat-box">
              <span className="stat-label">Payment Received</span>
              <span className="stat-value">
                {onboarding.agreement_currency || "INR"} {Number(onboarding.payment?.amount_paid || 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          {onboarding.onboarding_status === "draft" ? (
            <div className="publish-actions-row">
              <button type="button" className="button-link primary-publish-btn" onClick={publish} disabled={busy}>
                {busy ? "Publishing..." : "Publish Institute"}
              </button>
            </div>
          ) : (
            <div className="publish-actions-row">
              <Link className="button-link" to={`/super-admin/institutes/${onboarding.id}`}>
                Manage institute
              </Link>
              <button type="button" className="secondary-done-btn" onClick={() => navigate("/super-admin/onboarding")}>
                Done
              </button>
            </div>
          )}
        </CollapsiblePanel>
      )}
    </div>
  );
}
