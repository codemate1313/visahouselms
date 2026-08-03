import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { Badge, Button, PageHeader } from "@/components/ui";
import { sessionsStrings as strings } from "./Sessions.strings";

interface SessionInfo {
  id: number;
  user_agent: string | null;
  ip_address: string | null;
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
        <p>{strings.loading}</p>
      ) : (
        <table className="data-table sessions-table">
          <thead>
            <tr>
              <th>{strings.table.device}</th>
              <th>{strings.table.ipAddress}</th>
              <th>{strings.table.signedIn}</th>
              <th>{strings.table.expires}</th>
              <th className="table-actions-heading">{strings.table.actions}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>
                  {describeAgent(session.user_agent)}
                  {session.is_current && <Badge tone="green">{strings.thisSession}</Badge>}
                </td>
                <td>{session.ip_address ?? "—"}</td>
                <td>{new Date(session.created_at).toLocaleString()}</td>
                <td>{new Date(session.expires_at).toLocaleString()}</td>
                <td className="table-actions">
                  <div className="table-actions sessions-table-actions">
                    {!session.is_current && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(session)}
                        className="danger"
                        aria-label={strings.revokeSession}
                        data-tooltip={strings.revokeSession}
                      >
                        <Icon name="revoke" />
                      </button>
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
