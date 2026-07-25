import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import type { Course } from "@/api/types";
import { courseAssignmentsStrings as strings } from "./CourseAssignments.strings";
import type { Institute } from "./types";
import { CourseHeaderActions } from "./components/CourseHeaderActions";
import { CourseOverview } from "./components/CourseOverview";
import { AssignInstituteForm } from "./components/AssignInstituteForm";
import { CourseResourcesPanel } from "./components/CourseResourcesPanel";
import { AccessHistoryTable } from "./components/AccessHistoryTable";

export function CourseAssignments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [{ data: courseData }, { data: instituteData }] = await Promise.all([
        apiClient.get<Course>(`/super-admin/courses/${id}`),
        apiClient.get<Institute[]>("/super-admin/institutes"),
      ]);
      setCourse(courseData);
      setInstitutes(instituteData);
    } catch {
      setError(strings.errors.load);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function assign(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`/super-admin/courses/${id}/assignments`, { institute_id: Number(selected) });
      setSelected("");
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.assign));
    } finally {
      setSaving(false);
    }
  }

  async function unassign(instituteId: number) {
    if (!await confirmAction(strings.revokeConfirm, { title: strings.revokeConfirmTitle, confirmText: strings.revokeConfirmButton, variant: "warning" })) return;
    try {
      await apiClient.delete(`/super-admin/courses/${id}/assignments/${instituteId}`);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.revoke));
    }
  }

  async function toggleVisibility() {
    try {
      await apiClient.patch(`/super-admin/courses/${id}/visibility`, { is_visible: !course?.is_visible });
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.visibility));
    }
  }

  async function changeStatus(status: string) {
    try {
      await apiClient.post(`/super-admin/courses/${id}/status`, { status });
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.status));
    }
  }

  async function removeCourse() {
    if (!await confirmDelete(strings.deleteConfirm(course?.title ?? ""), strings.deleteConfirmTitle)) return;
    try {
      await apiClient.delete(`/super-admin/courses/${id}`);
      navigate("/super-admin/courses");
    } catch (err) {
      setError(extractErrorMessage(err, strings.errors.delete));
    }
  }

  if (!course && !error) return <p>{strings.loading}</p>;
  if (!course) return <p className="error-text">{error}</p>;
  const activeIds = new Set(course.assignments?.filter((item) => item.is_active).map((item) => item.institute_id));
  const available = institutes.filter((item) => item.is_active && !activeIds.has(item.id));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{course.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
        <Link to="/super-admin/courses">{strings.backToHierarchy}</Link>
      </div>
      {error && <p className="error-text">{error}</p>}
      <CourseHeaderActions course={course} onToggleVisibility={toggleVisibility} onChangeStatus={changeStatus} onRemoveCourse={removeCourse} />
      <CourseOverview course={course} />
      <div className="assignment-grid">
        <AssignInstituteForm course={course} available={available} selected={selected} onSelectedChange={setSelected} saving={saving} onSubmit={assign} />
        <CourseResourcesPanel assets={course.assets} />
      </div>
      <AccessHistoryTable assignments={course.assignments} onUnassign={unassign} />
    </div>
  );
}
