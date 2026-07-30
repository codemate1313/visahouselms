import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { DirectoryUser } from "@/api/types";
import { MemberFormFields } from "@/pages/institute/InstituteMemberForm/components/MemberFormFields";
import { usersStrings as strings } from "./Users.strings";

const basePath = "/super-admin/users/students";

export function DirectStudentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
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
        setForm({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number ?? "",
          address: data.address ?? "",
        });
      })
      .catch((err: unknown) => setError(extractErrorMessage(err, "Failed to load direct student.")))
      .finally(() => setLoading(false));
  }, [id]);

  function set(field: keyof typeof form) {
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
      setError(extractErrorMessage(err, "Failed to save direct student."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>{strings.loading}</p>;

  return (
    <MemberFormFields
      isNew={false}
      label="direct student"
      form={form}
      saving={saving}
      error={error}
      onFieldChange={set}
      onSubmit={submit}
      onCancel={() => navigate(basePath)}
    />
  );
}
