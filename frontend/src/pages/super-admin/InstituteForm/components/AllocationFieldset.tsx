import { RequiredMark } from "@/components/ui";
import { EMPTY_ALLOCATION } from "../types";

interface AllocationFieldsetProps {
  allocation: typeof EMPTY_ALLOCATION;
  onChange: (field: keyof typeof EMPTY_ALLOCATION, value: string) => void;
}

export function AllocationFieldset({ allocation, onChange }: AllocationFieldsetProps) {
  return (
    <div>
      <div className="form-section-header" style={{ marginTop: 32 }}>
        <h2 className="form-section-title">Capacity & Quota Allocations</h2>
        <p className="form-section-subtitle">
          What this institute is provisioned with. Students take unlimited tests.
        </p>
      </div>

      <div className="form-grid-4col">
        <div>
          <label htmlFor="student_limit">Student Limit<RequiredMark /></label>
          <input
            id="student_limit"
            type="number"
            min="0"
            value={allocation.student_limit}
            onChange={(event) => onChange("student_limit", event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="staff_limit">Instructor Limit<RequiredMark /></label>
          <input
            id="staff_limit"
            type="number"
            min="0"
            value={allocation.staff_limit}
            onChange={(event) => onChange("staff_limit", event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="access_duration_days">Access Duration (Days)<RequiredMark /></label>
          <input
            id="access_duration_days"
            type="number"
            min="1"
            value={allocation.access_duration_days}
            onChange={(event) => onChange("access_duration_days", event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="grace_days">Grace Period (Days)</label>
          <input
            id="grace_days"
            type="number"
            min="0"
            value={allocation.grace_days}
            onChange={(event) => onChange("grace_days", event.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
