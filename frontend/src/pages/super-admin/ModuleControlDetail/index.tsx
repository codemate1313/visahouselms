import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { moduleControlDetailStrings as strings } from "./ModuleControlDetail.strings";
import type { Institute, ManagedModule } from "./types";
import { ModuleDetailHeader } from "./components/ModuleDetailHeader";
import { ActionToolbar } from "./components/ActionToolbar";
import { OverviewCard } from "./components/OverviewCard";
import { AssignInstitutePanel } from "./components/AssignInstitutePanel";
import { InstituteAccessTable } from "./components/InstituteAccessTable";

export function ModuleControlDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [module, setModule] = useState<ManagedModule | null>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const [{ data: moduleData }, { data: instituteData }] = await Promise.all([
      apiClient.get<ManagedModule>(`/super-admin/modules/${id}`),
      apiClient.get<Institute[]>("/super-admin/institutes"),
    ]);
    setModule(moduleData);
    setInstitutes(instituteData);
  }

  useEffect(() => {
    load().catch(() => setError(strings.errors.load));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [id]);

  async function assign(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await apiClient.post(`/super-admin/modules/${id}/assignments`, {
        institute_id: Number(selected),
      });
      setSelected("");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.assign));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(instituteId: number, instituteName: string) {
    const confirmed = await confirmAction(
      strings.confirm.revokeAccess(module?.title ?? "", instituteName),
      {
        title: strings.confirm.revokeAccessTitle,
        confirmText: strings.confirm.revokeAccessConfirm,
        cancelText: strings.confirm.cancel,
        variant: "danger",
      }
    );
    if (!confirmed) return;

    try {
      await apiClient.delete(`/super-admin/modules/${id}/assignments/${instituteId}`);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.revoke));
    }
  }

  async function toggleVisibility() {
    if (!module) return;
    const willHide = module.is_visible;
    const confirmed = await confirmAction(
      willHide ? strings.confirm.hideCourse(module.title) : strings.confirm.makeVisible(module.title),
      {
        title: willHide ? strings.confirm.hideCourseTitle : strings.confirm.makeVisibleTitle,
        confirmText: willHide ? strings.confirm.hideCourseConfirm : strings.confirm.makeVisibleConfirm,
        cancelText: strings.confirm.cancel,
        variant: willHide ? "warning" : "primary",
      }
    );
    if (!confirmed) return;

    try {
      await apiClient.patch(`/super-admin/modules/${id}/visibility`, { is_visible: !willHide });
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.visibility));
    }
  }

  async function changeStatus(next: string) {
    if (!module) return;
    const isArchive = next === "archived";
    const confirmed = await confirmAction(
      isArchive ? strings.confirm.archiveCourse(module.title) : strings.confirm.publishCourse(module.title),
      {
        title: isArchive ? strings.confirm.archiveCourseTitle : strings.confirm.publishCourseTitle,
        confirmText: isArchive ? strings.confirm.archiveCourseConfirm : strings.confirm.publishCourseConfirm,
        cancelText: strings.confirm.cancel,
        variant: isArchive ? "warning" : "primary",
      }
    );
    if (!confirmed) return;

    try {
      await apiClient.post(`/super-admin/modules/${id}/status`, { status: next });
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.status));
    }
  }

  async function remove() {
    if (!module) return;
    const confirmed = await confirmDelete(strings.confirm.deleteCourse(module.title), strings.confirm.deleteCourseTitle);
    if (!confirmed) return;

    try {
      await apiClient.delete(`/super-admin/modules/${id}`);
      navigate("/super-admin/modules");
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.delete));
    }
  }

  if (!module) return <div className="course-loading-state">{error || strings.loading}</div>;

  const activeIds = new Set(
    module.assignments.filter((item) => item.is_active).map((item) => item.institute_id)
  );
  const available = institutes.filter(
    (item) => item.is_active && item.onboarding_status === "published" && !activeIds.has(item.id)
  );

  return (
    <div className="module-detail-page">
      <ModuleDetailHeader module={module} />

      {error && <div className="error-text detail-error-banner">{error}</div>}

      <ActionToolbar module={module} onToggleVisibility={toggleVisibility} onChangeStatus={changeStatus} onRemove={remove} />
      <OverviewCard module={module} />
      <AssignInstitutePanel module={module} available={available} selected={selected} onSelectedChange={setSelected} busy={busy} onSubmit={assign} />
      <InstituteAccessTable assignments={module.assignments} onRevoke={revoke} />
    </div>
  );
}
