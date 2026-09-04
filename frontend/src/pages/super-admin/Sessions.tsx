import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { Badge, Button, IconButton, PageHeader } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { formatDateTime } from "@/utils/date";
import { sessionsStrings as strings } from "./Sessions.strings";

interface SessionInfo {
  id: number;
  user_agent: string | null;
  ip_address: string | null;
  location: {
    label: string;
    city: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    resolved: boolean;
  };
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

function describeAgent(userAgent: string | null): string {
  if (!userAgent) return strings.unknownDevice;
  if (userAgent.includes("curl")) return "curl / API client";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Edg")) return "Edge";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Safari")) return "Safari";
  return userAgent.slice(0, 40);
}

function sessionLocation(session: SessionInfo): string {
  const label = session.location?.label?.trim();
  return label && label !== "Unknown" ? label : strings.unknownLocation;
}

interface SessionsProps {
  apiBase?: string;
}

export function Sessions({ apiBase = "/super-admin" }: SessionsProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadSessions() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<SessionInfo[]>(`${apiBase}/me/sessions`);
      setSessions(data);
      setError(null);
    } catch {
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRevoke(session: SessionInfo) {
    setError(null);
    setNotice(null);
    try {
      await apiClient.delete(`${apiBase}/me/sessions/${session.id}`);
      await loadSessions();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.revoke));
    }
  }

  async function handleRevokeOthers() {
    setError(null);
    setNotice(null);
    try {
      const { data } = await apiClient.post(`${apiBase}/me/sessions/revoke-others`, {});
      setNotice(strings.revokedOthers(data.revoked));
      await loadSessions();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.revokeOthers));
    }
  }

  return (
    <div>
      <PageHeader
        title={strings.title}
        actions={<Button onClick={handleRevokeOthers}>{strings.signOutOthers}</Button>}
      />

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      {loading ? (
        <RouteLoadingState />
      ) : (
        <table className="data-table sessions-table">
          <thead>
            <tr>
              <th>{strings.table.device}</th>
              <th>{strings.table.ipAddress}</th>
              <th>{strings.table.location}</th>
              <th>{strings.table.signedIn}</th>
              <th>{strings.table.expires}</th>
              <th className="table-actions-heading">{strings.table.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>
                  <div className="session-device-wrap">
                    <span className="session-device-name">{describeAgent(session.user_agent)}</span>
                    {session.is_current && <Badge tone="green">{strings.thisSession}</Badge>}
                  </div>
                </td>
                <td>{session.ip_address ?? "—"}</td>
                <td>
                  <span className={session.location?.resolved ? "session-location-resolved" : "session-location-muted"}>
                    {sessionLocation(session)}
                  </span>
                </td>
                <td>{formatDateTime(session.created_at)}</td>
                <td>{formatDateTime(session.expires_at)}</td>
                <td className="table-actions">
                  <div className="table-actions sessions-table-actions">
                    {!session.is_current && (
                      <IconButton
                        icon={<Icon name="logout" />}
                        variant="danger"
                        size="sm"
                        onClick={() => handleRevoke(session)}
                        label={strings.revokeSession}
                        className="session-signout-btn"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
