import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { InstituteMember, MemberCapacity } from "../InstituteMembers";
import { instituteMemberFormStrings as strings } from "./InstituteMemberForm.strings";
import { CapacityLockedView } from "./components/CapacityLockedView";
import { CredentialCreatedView } from "./components/CredentialCreatedView";
import { MemberFormFields } from "./components/MemberFormFields";

interface Props {
  role: InstituteMember["role"];
  instituteId?: number;
  returnPath?: string;
}

export function InstituteMemberForm({ role, instituteId, returnPath }: Props) {
  const params = useParams();
  const id = instituteId === undefined ? params.id : params.memberId ?? params.studentId;
  const isNew = id === undefined;
  const isStudent = role === "STUDENT";
  const label = isStudent ? "student" : "instructor";
  const apiBase = instituteId === undefined ? "/institute" : `/super-admin/institutes/${instituteId}`;
  const basePath = returnPath ?? (instituteId === undefined
    ? isStudent ? "/institute-portal/students" : "/institute-portal/staff"
    : `/super-admin/institutes/${instituteId}/accounts`);
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", first_name: "", last_name: "", phone_number: "", address: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<MemberCapacity | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew) return;
    apiClient.get<MemberCapacity>(`${apiBase}/member-capacity`)
      .then(({ data }) => setCapacity(data))
      .catch((err: unknown) => setError(extractErrorMessage(err, strings.errors.loadCapacity)))
      .finally(() => setLoading(false));
  }, [apiBase, isNew]);

  useEffect(() => {
    if (isNew) return;
    apiClient.get<InstituteMember>(`${apiBase}/members/${id}`)
      .then(({ data }) => {
        if (data.role !== role) {
          navigate(basePath, { replace: true });
          return;
        }
        setForm({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number ?? "",
          address: data.address ?? "",
        });
      })
      .catch((err: unknown) => setError(extractErrorMessage(err, strings.errors.load(label))))
      .finally(() => setLoading(false));
  }, [apiBase, basePath, id, isNew, label, navigate, role]);

  function set(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, role, phone_number: form.phone_number || null, address: form.address || null };
    try {
      if (isNew) {
        const { data } = await apiClient.post(`${apiBase}/members`, payload);
        setCreatedPassword(data.temporary_password);
      } else {
        await apiClient.patch(`${apiBase}/members/${id}`, payload);
        navigate(basePath);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save(label)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>{strings.loading}</p>;

  if (isNew) {
    const resource: "students" | "staff" = isStudent ? "students" : "staff";
    const canAdd = Boolean(capacity?.can_add[resource]);
    if (!canAdd) {
      const limit = capacity?.limits[resource];
      return (
        <CapacityLockedView
          label={label}
          isStudent={isStudent}
          limitIsZero={limit === 0}
          error={error}
          onBack={() => navigate(basePath)}
        />
      );
    }
  }

  if (createdPassword) {
    return (
      <CredentialCreatedView
        isStudent={isStudent}
        email={form.email}
        password={createdPassword}
        onDone={() => navigate(basePath)}
      />
    );
  }

  return (
    <MemberFormFields
      isNew={isNew}
      label={label}
      form={form}
      saving={saving}
      error={error}
      onFieldChange={set}
      onSubmit={submit}
      onCancel={() => navigate(basePath)}
    />
  );
}

export function SuperAdminStudentForm() {
  const { id } = useParams();
  return <InstituteMemberForm role="STUDENT" instituteId={Number(id)} returnPath={`/super-admin/institutes/${id}/accounts`} />;
}

export function SuperAdminInstructorForm() {
  const { id } = useParams();
  return <InstituteMemberForm role="INST_INSTRUCTOR" instituteId={Number(id)} returnPath={`/super-admin/institutes/${id}/accounts`} />;
}
