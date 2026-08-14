import { RequiredMark } from "@/components/ui";
import { EMPTY_ALLOCATION } from "../types";

interface AllocationFieldsetProps {
  allocation: typeof EMPTY_ALLOCATION;
  onChange: (field: keyof typeof EMPTY_ALLOCATION, value: string) => void;
  isPackageLocked?: boolean;
}

export function AllocationFieldset({ allocation, onChange, isPackageLocked = false }: AllocationFieldsetProps) {
  const lockedStyle = isPackageLocked
    ? { background: "var(--surface-muted)", cursor: "not-allowed", opacity: 0.88 }
    : undefined;
  const lockedTitle = isPackageLocked
    ? "Locked to selected package — choose 'Custom / No Package' to edit manually"
    : undefined;

  return (
    <div>
      <div className="form-section-header" style={{ marginTop: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 className="form-section-title" style={{ margin: 0 }}>Capacity & Quota Allocations</h2>
          {isPackageLocked && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)" }}>
              Locked by Package
            </span>
          )}
        </div>
        <p className="form-section-subtitle">
          {isPackageLocked
            ? "Allocations are fixed by the chosen package. Switch to 'Custom / No Package' above to modify manually."
            : "What this institute is provisioned with. Students take unlimited tests."}
        </p>
      </div>

      <div className="form-grid-4col">
        <div>
          <label htmlFor="student_limit">Student Limit<RequiredMark /></label>
          <input
            id="student_limit"
            type="number"
            min="0"
            placeholder="e.g. 50"
            value={allocation.student_limit}
            onChange={(event) => onChange("student_limit", event.target.value)}
            disabled={isPackageLocked}
            style={lockedStyle}
            title={lockedTitle}
            required
          />
        </div>
        <div>
          <label htmlFor="staff_limit">Instructor Limit<RequiredMark /></label>
          <input
            id="staff_limit"
            type="number"
            min="0"
            placeholder="e.g. 5"
            value={allocation.staff_limit}
            onChange={(event) => onChange("staff_limit", event.target.value)}
            disabled={isPackageLocked}
            style={lockedStyle}
            title={lockedTitle}
            required
          />
        </div>
        <div>
          <label htmlFor="access_duration_days">Access Duration (Days)<RequiredMark /></label>
          <input
            id="access_duration_days"
            type="number"
            min="1"
            placeholder="e.g. 365"
            value={allocation.access_duration_days}
            onChange={(event) => onChange("access_duration_days", event.target.value)}
            disabled={isPackageLocked}
            style={lockedStyle}
            title={lockedTitle}
            required
          />
        </div>
        <div>
          <label htmlFor="grace_days">Grace Period (Days)</label>
          <input
            id="grace_days"
            type="number"
            min="0"
            placeholder="e.g. 0"
            value={allocation.grace_days}
            onChange={(event) => onChange("grace_days", event.target.value)}
            disabled={isPackageLocked}
            style={lockedStyle}
            title={lockedTitle}
          />
        </div>
      </div>
    </div>
  );
}
