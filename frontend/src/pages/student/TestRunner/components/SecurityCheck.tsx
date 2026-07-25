import { testRunnerStrings as strings } from "../TestRunner.strings";

interface SecurityCheckProps {
  label: string;
  active: boolean;
}

export function SecurityCheck({ label, active }: SecurityCheckProps) {
  return (
    <div className={`test-security-check${active ? " is-active" : ""}`}>
      <span aria-hidden="true" />
      <strong>{label}</strong>
      <small>{active ? strings.security.ready : strings.security.required}</small>
    </div>
  );
}
