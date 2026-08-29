import { type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, Modal, RequiredMark } from "@/components/ui";
import {
  PlanCoursePicker,
  type PlanModule,
} from "@/pages/super-admin/PlanForm/components/PlanCoursePicker";
import {
  AgreementAttachments,
  type AgreementAttachment,
} from "@/pages/super-admin/InstituteForm/components/AgreementAttachments";
import { useToastStore } from "@/store/toastStore";
import { isEqual } from "@/utils/isEqual";
import { noChangesMessage } from "@/content/common.strings";
import { subscriptionsStrings as strings } from "../Subscriptions.strings";
import "./PlanEditDialog.css";

export interface InstitutePlanEditValues {
  agreement_reference: string;
  agreement_notes: string;
  agreed_amount: string;
  currency: string;
  student_limit: number;
  staff_limit: number;
  access_duration_days: number;
  grace_days: number;
  module_ids: number[];
}

interface PlanEditDialogProps {
  agreementDocument: AgreementAttachment | null;
  busy: boolean;
  initialValues: InstitutePlanEditValues;
  instituteName: string;
  onClose: () => void;
  onDownloadAttachment: (attachment: AgreementAttachment) => void;
  onRemoveAttachment: (kind: "agreement" | "payment-proof") => void;
  onSave: (
    values: InstitutePlanEditValues,
    files: { agreementDocument: File | null; paymentProof: File | null },
  ) => Promise<boolean>;
  open: boolean;
  paymentProof: AgreementAttachment | null;
}

interface EditForm {
  agreement_reference: string;
  agreement_notes: string;
  agreed_amount: string;
  currency: string;
  student_limit: string;
  staff_limit: string;
  access_duration_days: string;
  grace_days: string;
}

function toForm(values: InstitutePlanEditValues): EditForm {
  return {
    agreement_reference: values.agreement_reference,
    agreement_notes: values.agreement_notes,
    agreed_amount: values.agreed_amount ? String(Number(values.agreed_amount)) : "",
    currency: values.currency,
    student_limit: String(values.student_limit),
    staff_limit: String(values.staff_limit),
    access_duration_days: String(values.access_duration_days),
    grace_days: String(values.grace_days),
  };
}

/** Normalizes a set of plan edit values into the exact shape/formatting used
 *  for the save payload, so the pristine `initialValues` and the live
 *  form/selectedModules can be compared like-for-like. Module ids are sorted
 *  since they're semantically a set - toggling one off and back on shouldn't
 *  register as a change just because it moved to the end of the list. */
function toComparable(values: InstitutePlanEditValues): Record<string, unknown> {
  return {
    agreement_reference: values.agreement_reference.trim(),
    agreement_notes: values.agreement_notes.trim(),
    agreed_amount: values.agreed_amount,
    currency: values.currency.trim().toUpperCase(),
    student_limit: values.student_limit,
    staff_limit: values.staff_limit,
    access_duration_days: values.access_duration_days,
    grace_days: values.grace_days,
    module_ids: [...values.module_ids].sort((a, b) => a - b),
  };
}

export function PlanEditDialog({
  agreementDocument,
  busy,
  initialValues,
  instituteName,
  onClose,
  onDownloadAttachment,
  onRemoveAttachment,
  onSave,
  open,
  paymentProof,
}: PlanEditDialogProps) {
  const t = strings.editDialog;
  const [form, setForm] = useState<EditForm>(() => toForm(initialValues));
  const [modules, setModules] = useState<PlanModule[]>([]);
  const [selectedModules, setSelectedModules] = useState<Set<number>>(
    () => new Set(initialValues.module_ids),
  );
  const [loadingModules, setLoadingModules] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [agreementDocumentFile, setAgreementDocumentFile] = useState<File | null>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const showInfo = useToastStore((state) => state.showInfo);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(initialValues));
    setSelectedModules(new Set(initialValues.module_ids));
    setLoadError(null);
    setSaveError(null);
    setAgreementDocumentFile(null);
    setPaymentProofFile(null);
    setLoadingModules(true);
    apiClient
      .get<PlanModule[]>("/super-admin/plans/available-modules")
      .then(({ data }) => setModules(data))
      .catch((error: unknown) => setLoadError(extractErrorMessage(error, t.errors.loadCourses)))
      .finally(() => setLoadingModules(false));
  }, [initialValues, open, t.errors.loadCourses]);

  function setField(field: keyof EditForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleModule(moduleId: number) {
    setSelectedModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  }

  function toggleAllModules() {
    setSelectedModules((current) => (
      current.size === modules.length
        ? new Set()
        : new Set(modules.map((module) => module.id))
    ));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoadError(null);
    setSaveError(null);

    const values: InstitutePlanEditValues = {
      agreement_reference: form.agreement_reference.trim(),
      agreement_notes: form.agreement_notes.trim(),
      agreed_amount: String(form.agreed_amount).replace(/,/g, "."),
      currency: form.currency.trim().toUpperCase(),
      student_limit: Number(form.student_limit),
      staff_limit: Number(form.staff_limit),
      access_duration_days: Number(form.access_duration_days),
      grace_days: Number(form.grace_days),
      module_ids: [...selectedModules],
    };

    // Attachments are immediate-effect uploads, not part of the reviewable
    // field diff - a new file always warrants the save, even if no other
    // field changed.
    const noFieldChanges = !agreementDocumentFile
      && !paymentProofFile
      && isEqual(toComparable(initialValues), toComparable(values));

    if (noFieldChanges) {
      showInfo(noChangesMessage);
      return;
    }

    const saved = await onSave(values, {
      agreementDocument: agreementDocumentFile,
      paymentProof: paymentProofFile,
    });
    if (saved) onClose();
    else setSaveError(t.errors.save);
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      size="lg"
      title={t.title}
      className="subscription-plan-edit-dialog"
      actions={(
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            form="subscription-plan-edit-form"
            loading={busy}
            disabled={loadingModules || Boolean(loadError)}
          >
            {t.save}
          </Button>
        </>
      )}
    >
      <p className="subscription-plan-edit-intro">{t.description(instituteName)}</p>

      <form id="subscription-plan-edit-form" onSubmit={submit}>
        <section className="subscription-plan-edit-section">
          <div className="subscription-plan-edit-heading">
            <h3>{t.agreementHeading}</h3>
            <p>{t.agreementHint}</p>
          </div>
          <div className="subscription-plan-edit-grid agreement-grid">
            <label>
              <span>{t.reference}<RequiredMark /></span>
              <input
                value={form.agreement_reference}
                maxLength={100}
                onChange={(event) => setField("agreement_reference", event.target.value)}
                required
              />
            </label>
            <label>
              <span>{t.amount}<RequiredMark /></span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={form.agreed_amount}
                onChange={(event) => {
                  const val = event.target.value.replace(/,/g, ".");
                  if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                    setField("agreed_amount", val);
                  }
                }}
                placeholder="0.00"
                required
              />
            </label>
            <label>
              <span>{t.currency}<RequiredMark /></span>
              <input
                value={form.currency}
                minLength={3}
                maxLength={8}
                onChange={(event) => setField("currency", event.target.value)}
                required
              />
            </label>
          </div>
          <label className="subscription-plan-edit-notes">
            <span>{t.notes}</span>
            <textarea
              rows={2}
              maxLength={2000}
              value={form.agreement_notes}
              onChange={(event) => setField("agreement_notes", event.target.value)}
            />
          </label>
          <AgreementAttachments
            agreementDocument={agreementDocument}
            agreementDocumentFile={agreementDocumentFile}
            paymentProof={paymentProof}
            paymentProofFile={paymentProofFile}
            onAgreementDocumentChange={setAgreementDocumentFile}
            onPaymentProofChange={setPaymentProofFile}
            onDownload={onDownloadAttachment}
            onRemoveAgreementDocument={() => onRemoveAttachment("agreement")}
            onRemovePaymentProof={() => onRemoveAttachment("payment-proof")}
          />
        </section>

        <section className="subscription-plan-edit-section">
          <div className="subscription-plan-edit-heading">
            <h3>{t.allocationHeading}</h3>
            <p>{t.allocationHint}</p>
          </div>
          <div className="subscription-plan-edit-grid">
            <label>
              <span>{t.students}<RequiredMark /></span>
              <input
                type="number"
                min="0"
                value={form.student_limit}
                onChange={(event) => setField("student_limit", event.target.value)}
                required
              />
            </label>
            <label>
              <span>{t.instructors}<RequiredMark /></span>
              <input
                type="number"
                min="0"
                value={form.staff_limit}
                onChange={(event) => setField("staff_limit", event.target.value)}
                required
              />
            </label>
            <label>
              <span>{t.duration}<RequiredMark /></span>
              <input
                type="number"
                min="1"
                value={form.access_duration_days}
                onChange={(event) => setField("access_duration_days", event.target.value)}
                required
              />
            </label>
            <label>
              <span>{t.grace}</span>
              <input
                type="number"
                min="0"
                value={form.grace_days}
                onChange={(event) => setField("grace_days", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="subscription-plan-edit-section course-section">
          <div className="subscription-plan-edit-heading">
            <h3>{t.coursesHeading}</h3>
            <p>{t.coursesHint}</p>
          </div>
          {loadingModules ? (
            <p className="hint">{t.loadingCourses}</p>
          ) : loadError ? (
            <p className="error-text" role="alert">{loadError}</p>
          ) : (
            <PlanCoursePicker
              modules={modules}
              selected={selectedModules}
              onToggle={toggleModule}
              onToggleAll={toggleAllModules}
            />
          )}
        </section>
        {saveError && <p className="error-text" role="alert">{saveError}</p>}
      </form>
    </Modal>
  );
}
