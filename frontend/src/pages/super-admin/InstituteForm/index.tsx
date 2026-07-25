import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RequiredMark } from "@/components/ui";
import { instituteFormStrings as strings } from "./InstituteForm.strings";
import { DEFAULT_PERMISSIONS, type CreatedInstitute, type InstitutePermissions } from "./types";
import { CreatedInstituteModal } from "./components/CreatedInstituteModal";
import { AdminAccountFields } from "./components/AdminAccountFields";
import { SessionPolicyFieldset } from "./components/SessionPolicyFieldset";
import { PermissionsFieldset } from "./components/PermissionsFieldset";

export function InstituteForm() {
  const { id } = useParams();
  const isNew = id === "new" || id === undefined;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [sessionDurationHours, setSessionDurationHours] = useState(24);
  const [permissions, setPermissions] = useState<InstitutePermissions>(DEFAULT_PERMISSIONS);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedInstitute | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get(`/super-admin/institutes/${id}`)
      .then(({ data }) => {
        setName(data.name);
        setContactEmail(data.contact_email ?? "");
        setSessionDurationHours(data.session_duration_hours ?? 24);
        setPermissions({ ...DEFAULT_PERMISSIONS, ...data.admin_permissions });
      })
      .catch(() => setError(strings.errors.load))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (isNew) {
        const { data } = await apiClient.post("/super-admin/institutes", {
          name,
          contact_email: contactEmail || null,
          admin_email: adminEmail,
          admin_first_name: adminFirstName,
          admin_last_name: adminLastName,
          admin_permissions: permissions,
          session_duration_hours: sessionDurationHours,
        });
        setCreated({ id: data.id, admin_email: data.admin_email, admin_temp_password: data.admin_temp_password });
      } else {
        await apiClient.patch(`/super-admin/institutes/${id}`, {
          name,
          contact_email: contactEmail || null,
          admin_permissions: permissions,
          session_duration_hours: sessionDurationHours,
        });
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

  if (loading) return <p>{strings.loading}</p>;

  if (created) {
    return (
      <CreatedInstituteModal
        created={created}
        copied={copied}
        onCopyPassword={copyPassword}
        onAddStudents={() => navigate(`/super-admin/institutes/${created.id}/students`)}
        onDone={() => navigate("/super-admin/institutes")}
      />
    );
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: strings.breadcrumbInstitutes, to: "/super-admin/institutes" },
          { label: isNew ? strings.newTitle : name ? `${strings.editTitlePrefix} ${name}` : strings.editTitleFallback },
        ]}
      />
      <div className="page-header">
        <h1>{isNew ? strings.newTitle : strings.editTitleFallback}</h1>
        {!isNew && (
          <div className="form-actions">
            <Link className="button-link" to={`/super-admin/institutes/${id}/accounts`}>
              {strings.accounts}
            </Link>
            <Link className="button-link secondary-button" to={`/super-admin/institutes/${id}/branding`}>
              {strings.branding}
            </Link>
          </div>
        )}
      </div>
      <form className="form-card wide" onSubmit={handleSubmit}>
        <label htmlFor="name">{strings.nameLabel}<RequiredMark /></label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />

        <label htmlFor="contact_email">{strings.contactEmailLabel}</label>
        <input id="contact_email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder={strings.contactEmailPlaceholder} />

        {isNew && (
          <AdminAccountFields
            adminEmail={adminEmail}
            onAdminEmailChange={setAdminEmail}
            adminFirstName={adminFirstName}
            onAdminFirstNameChange={setAdminFirstName}
            adminLastName={adminLastName}
            onAdminLastNameChange={setAdminLastName}
          />
        )}

        <SessionPolicyFieldset sessionDurationHours={sessionDurationHours} onSessionDurationHoursChange={setSessionDurationHours} />
        <PermissionsFieldset permissions={permissions} onPermissionsChange={setPermissions} />

        {error && <p className="error-text">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? strings.saving : strings.save}
          </button>
          <button type="button" onClick={() => navigate("/super-admin/institutes")}>
            {strings.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
