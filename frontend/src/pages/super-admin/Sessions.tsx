import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { useAuthStore } from "../../store/authStore";

interface SessionInfo {
  id: number;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

function describeAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
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
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadSessions() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<SessionInfo[]>(`${apiBase}/me/sessions`, {
        headers: refreshToken ? { "X-Refresh-Token": refreshToken } : undefined,
      });
      setSessions(data);
      setError(null);
    } catch {
      setError("Failed to load sessions.");
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
      setError(extractErrorMessage(err, "Failed to revoke session."));
    }
  }

  async function handleRevokeOthers() {
    if (!refreshToken) return;
    setError(null);
    setNotice(null);
    try {
      const { data } = await apiClient.post(`${apiBase}/me/sessions/revoke-others`, {
        refresh_token: refreshToken,
      });
      setNotice(`Revoked ${data.revoked} other session${data.revoked === 1 ? "" : "s"}.`);
      await loadSessions();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to revoke other sessions."));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Active Sessions</h1>
        <button onClick={handleRevokeOthers}>Sign out other sessions</button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {notice && <p className="success-text">{notice}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>IP Address</th>
              <th>Signed in</th>
              <th>Expires</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td>
                  {describeAgent(session.user_agent)}
                  {session.is_current && <span className="badge badge-green">this session</span>}
                </td>
                <td>{session.ip_address ?? "—"}</td>
                <td>{new Date(session.created_at).toLocaleString()}</td>
                <td>{new Date(session.expires_at).toLocaleString()}</td>
                <td className="table-actions">
                  {!session.is_current && (
                    <button onClick={() => handleRevoke(session)} className="danger">
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
