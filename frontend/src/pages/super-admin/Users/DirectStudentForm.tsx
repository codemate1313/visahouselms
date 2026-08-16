import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { DirectoryRole, DirectoryUser } from "@/api/types";
import { MemberFormFields, type MemberFormField } from "@/pages/institute/InstituteMemberForm/components/MemberFormFields";
import { usersStrings as strings } from "./Users.strings";

const ROLE_LABELS: Partial<Record<DirectoryRole, string>> = {
  INSTITUTE_ADMIN: "institute admin",
  INST_INSTRUCTOR: "institute staff",
  STUDENT: "student",
};

const ROLE_SLUGS: Partial<Record<DirectoryRole, string>> = {
  INSTITUTE_ADMIN: "institute-admins",
  INST_INSTRUCTOR: "institute-staff",
  STUDENT: "students",
};

export function DirectStudentForm({ portalBasePath = "/super-admin" }: { portalBasePath?: string }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<DirectoryUser | null>(null);
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    address: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<DirectoryUser>(`/super-admin/users/${id}`)
      .then(({ data }) => {
        setUser(data);
        setForm({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number ?? "",
          address: data.address ?? "",
        });
      })
      .catch((err: unknown) => setError(extractErrorMessage(err, "Failed to load user.")))
      .finally(() => setLoading(false));
  }, [id]);

  const roleLabel = user?.role_name ? ROLE_LABELS[user.role_name] ?? "user" : "user";
  const basePath = `${portalBasePath}/users/${user?.role_name ? ROLE_SLUGS[user.role_name] ?? "students" : "students"}`;

  // Typed against the shared component's field union rather than this form's
  // own keys. A direct student has no institute and therefore no access window,
  // so the two access fields never render here - but the shared props type has
  // to admit them, and spreading by key stays correct either way.
  function set(field: MemberFormField) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/super-admin/users/${id}`, {
        ...form,
        phone_number: form.phone_number || null,
        address: form.address || null,
      });
      navigate(basePath);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to save ${roleLabel}.`));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>{strings.loading}</p>;

  return (
    <MemberFormFields
      isNew={false}
      label={roleLabel}
      form={form}
      saving={saving}
      error={error}
      onFieldChange={set}
      onSubmit={submit}
      onCancel={() => navigate(basePath)}
    />
  );
}
