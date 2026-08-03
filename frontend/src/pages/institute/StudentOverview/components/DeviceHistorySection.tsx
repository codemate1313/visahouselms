import type { DeviceRecord } from "../types";
import { studentOverviewStrings as strings } from "../StudentOverview.strings";
import { Badge } from "@/components/ui";

function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

interface DeviceHistorySectionProps {
  devices: DeviceRecord[];
}

export function DeviceHistorySection({ devices }: DeviceHistorySectionProps) {
  const t = strings.deviceHistory;
  const activeLabel = strings.status.active;
  return (
    <section className="student-record-section">
      <div className="section-heading">
        <div>
          <span className="page-eyebrow">{t.eyebrow}</span>
          <h2>{t.heading}</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t.device}</th>
              <th>{t.firstLogin}</th>
              <th>{t.lastLogin}</th>
              <th>{t.logins}</th>
              <th>{t.lastIp}</th>
              <th>{t.status}</th>
            </tr>
          </thead>
          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-cell">
                  {t.empty}
                </td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <strong>{device.name ?? t.unknownDevice}</strong>
                    <span className="device-agent">{device.user_agent}</span>
                  </td>
                  <td>{dateTime(device.first_seen_at)}</td>
                  <td>{dateTime(device.last_seen_at)}</td>
                  <td>{device.login_count}</td>
                  <td>{device.last_ip_address ?? "-"}</td>
                  <td>
                    <Badge tone={device.is_active ? "green" : "gray"}>
                      {device.is_active ? activeLabel : t.signedOut}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
