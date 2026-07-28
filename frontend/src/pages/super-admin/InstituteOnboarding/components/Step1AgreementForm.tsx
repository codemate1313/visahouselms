import type { FormEvent } from "react";
import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";
import { INITIAL } from "../helpers";
import type { Method, ModuleOption } from "../types";
import { InstituteAdminDetailsPanel } from "./InstituteAdminDetailsPanel";
import { PermissionsPanel } from "./PermissionsPanel";
import { AgreementPaymentPanel } from "./AgreementPaymentPanel";
import { IncludedCoursesPanel } from "./IncludedCoursesPanel";
import { Icon } from "@/components/icons";

interface Step1AgreementFormProps {
  form: typeof INITIAL;
  set: (field: keyof typeof INITIAL) => (event: { target: { value: string } }) => void;
  adminPermissions: Record<string, boolean>;
  onTogglePermission: (key: string, checked: boolean) => void;
  onToggleAllPermissions: () => void;
  methods: Method[];
  onPaymentMethodChange: (value: string) => void;
  modules: ModuleOption[];
  selectedModules: Set<number>;
  onToggleModule: (moduleId: number) => void;
  onToggleAllModules: () => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function Step1AgreementForm({
  form,
  set,
  adminPermissions,
  onTogglePermission,
  onToggleAllPermissions,
  methods,
  onPaymentMethodChange,
  modules,
  selectedModules,
  onToggleModule,
  onToggleAllModules,
  busy,
  onSubmit,
}: Step1AgreementFormProps) {
  const t = strings.step1;
  return (
    <form className="onboarding-split-form" onSubmit={onSubmit}>
      <div className="onboarding-grid-two-col">
        <div className="onboarding-col">
          <InstituteAdminDetailsPanel form={form} set={set} />
          <PermissionsPanel adminPermissions={adminPermissions} onTogglePermission={onTogglePermission} onToggleAll={onToggleAllPermissions} />
        </div>

        <div className="onboarding-col">
          <AgreementPaymentPanel form={form} set={set} methods={methods} onPaymentMethodChange={onPaymentMethodChange} />
          <IncludedCoursesPanel modules={modules} selectedModules={selectedModules} onToggleModule={onToggleModule} onToggleAll={onToggleAllModules} />
        </div>
      </div>

      <div className="onboarding-form-submit-bar">
        <button type="submit" disabled={busy || !selectedModules.size} className="primary-submit-btn">
          {busy ? t.creatingDraft : <>{t.createDraftAndContinue} <Icon name="arrowRight" /></>}
        </button>
      </div>
    </form>
  );
}
