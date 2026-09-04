import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { DEVELOPER_ACCESS_SLUG } from "@/config/developerAccess";
import { noChangesMessage } from "@/content/common.strings";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import { RouteLoadingState } from "@/components/RouteLoadingState";
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
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    address: "",
    // Deliberately blank. A pre-filled window is how a student ends up
    // outliving the subscription that paid for them - the admin has to choose.
    access_starts_on: "",
    access_ends_on: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<MemberCapacity | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const showInfo = useToastStore((state) => state.showInfo);
  const originalRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    // Fetched on edit as well as create: the date inputs cap themselves at the
    // subscription end, and that ceiling has to be known on both screens.
    apiClient.get<MemberCapacity>(`${apiBase}/member-capacity`)
      .then(({ data }) => setCapacity(data))
      .catch((err: unknown) => {
        if (isNew) setError(extractErrorMessage(err, strings.errors.loadCapacity));
      })
      .finally(() => { if (isNew) setLoading(false); });
  }, [apiBase, isNew]);

  // A new student starts today by default; only the end date is left blank,
  // because that is the decision the institute actually has to make.
  useEffect(() => {
    if (!isNew || !isStudent) return;
    setForm((current) => (current.access_starts_on ? current : { ...current, access_starts_on: todayIso() }));
  }, [isNew, isStudent]);

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
          access_starts_on: data.access_starts_on ?? "",
          access_ends_on: data.access_ends_on ?? "",
        });
        originalRef.current = {
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          role,
          phone_number: data.phone_number || null,
          address: data.address || null,
        };
      })
      .catch((err: unknown) => setError(extractErrorMessage(err, strings.errors.load(label))))
      .finally(() => setLoading(false));
  }, [apiBase, basePath, id, isNew, label, navigate, role]);

  function set(field: keyof typeof form) {
    return (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  function setEndDate(value: string) {
    setForm((current) => ({ ...current, access_ends_on: value }));
  }

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { access_starts_on, access_ends_on, ...rest } = form;
    // The window rides along only when creating a student. Editing a member
    // goes through PATCH /members/{id}, which never touches the dates - moving
    // a window is its own endpoint precisely so it can be audited and so it can
    // never be an accidental side effect of fixing a typo in someone's name.
    const payload: Record<string, unknown> = {
      ...rest,
      role,
      phone_number: form.phone_number || null,
      address: form.address || null,
    };
    if (isNew && isStudent) {
      payload.access_starts_on = access_starts_on;
      payload.access_ends_on = access_ends_on;
    }
    if (originalRef.current && isEqual(originalRef.current, payload)) {
      showInfo(noChangesMessage);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        // Seats can fill up elsewhere while this form stays open, so refresh
        // the capacity snapshot right before submitting - the mount-time fetch
        // only drives the initial gate/display, not the moment that matters.
        // Re-fetching here just updates `capacity`; if it now shows no room,
        // the render below falls back to CapacityLockedView on its own.
        const resource: "students" | "staff" = isStudent ? "students" : "staff";
        const { data: freshCapacity } = await apiClient.get<MemberCapacity>(`${apiBase}/member-capacity`);
        setCapacity(freshCapacity);
        if (!freshCapacity.can_add[resource]) {
          setSaving(false);
          return;
        }
        const { data } = await apiClient.post(`${apiBase}/members`, payload);
        setCreatedPassword(data.temporary_password);
      } else {
        await apiClient.patch(`${apiBase}/members/${id}`, payload);
        originalRef.current = payload;
        navigate(basePath);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.save(label)));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <RouteLoadingState />;

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
      showAccessWindow={isStudent && isNew}
      subscriptionEndsOn={capacity?.subscription_ends_on ?? null}
      saving={saving}
      error={error}
      onFieldChange={set}
      onSetEndDate={setEndDate}
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

const developerAccessSlug = DEVELOPER_ACCESS_SLUG;

export function DeveloperStudentForm() {
  const { id } = useParams();
  return <InstituteMemberForm role="STUDENT" instituteId={Number(id)} returnPath={`/${developerAccessSlug}/institutes/${id}/accounts`} />;
}

export function DeveloperInstructorForm() {
  const { id } = useParams();
  return <InstituteMemberForm role="INST_INSTRUCTOR" instituteId={Number(id)} returnPath={`/${developerAccessSlug}/institutes/${id}/accounts`} />;
}
