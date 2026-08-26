import { MetricCard } from "@/components/dashboard/MetricCard";
import { formatDateTime } from "@/utils/date";
import { studentOverviewStrings as strings } from "../StudentOverview.strings";

function dateTime(value: string | null) {
  return formatDateTime(value, "-");
}

interface StudentStatTilesProps {
  testsTaken: number;
  deviceCount: number;
  activeSessionCount: number;
  lastLoginAt: string | null;
}

export function StudentStatTiles({ testsTaken, deviceCount, activeSessionCount, lastLoginAt }: StudentStatTilesProps) {
  const t = strings.stats;
  return (
    <div className="metric-grid">
      <MetricCard label={t.testsTaken} value={testsTaken} tone="blue" icon="grading" />
      <MetricCard label={t.devicesUsed} value={deviceCount} tone="purple" icon="session" />
      <MetricCard label={t.activeDevices} value={activeSessionCount} tone="green" icon="toggleOn" />
      <MetricCard label={t.lastLogin} value={dateTime(lastLoginAt)} valueClassName="stat-value-date" tone="slate" icon="logs" />
    </div>
  );
}
