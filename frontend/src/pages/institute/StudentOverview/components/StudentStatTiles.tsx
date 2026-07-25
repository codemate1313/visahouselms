import { studentOverviewStrings as strings } from "../StudentOverview.strings";

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
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
    <div className="stat-tile-row">
      <div className="stat-tile">
        <p className="stat-label">{t.testsTaken}</p>
        <p className="stat-value">{testsTaken}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{t.devicesUsed}</p>
        <p className="stat-value">{deviceCount}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{t.activeDevices}</p>
        <p className="stat-value">{activeSessionCount}</p>
      </div>
      <div className="stat-tile">
        <p className="stat-label">{t.lastLogin}</p>
        <p className="stat-value stat-value-date">{dateTime(lastLoginAt)}</p>
      </div>
    </div>
  );
}
