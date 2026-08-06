import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { Badge, Button, PageHeader, SearchInput } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import { formatDate } from "@/utils/date";
import "./AllSessions.css";

interface SessionLocation {
  label: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  resolved: boolean;
}

interface AdminSession {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  role: string | null;
  institute_name: string | null;
  device: string;
  ip_address: string | null;
  location: SessionLocation;
  created_at: string;
  expires_at: string;
}

interface SessionsResponse {
  total: number;
  sessions: AdminSession[];
}

interface InstituteOption {
  id: number;
  name: string;
}

const ROLE_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All roles" },
  { value: "SUPER_ADMIN", label: "Super Admins" },
  { value: "SA_INSTRUCTOR", label: "SA Instructors" },
  { value: "INSTITUTE_ADMIN", label: "Institute Admins" },
  { value: "INST_INSTRUCTOR", label: "Institute Instructors" },
  { value: "STUDENT", label: "Students" },
];

function mapsHref(location: SessionLocation): string | null {
  if (location.latitude == null || location.longitude == null) return null;
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

export function AllSessions() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  const [rows, setRows] = useState<AdminSession[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [institutes, setInstitutes] = useState<InstituteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<InstituteOption[] | { items: InstituteOption[] }>("/super-admin/institutes")
      .then(({ data }) => setInstitutes(Array.isArray(data) ? data : data.items ?? []))
      .catch(() => setInstitutes([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<SessionsResponse>("/super-admin/sessions", {
        params: {
          search: search.trim() || undefined,
          role: role || undefined,
          institute_id: instituteId || undefined,
          limit: 100,
        },
      });
      setRows(data.sessions);
      setTotal(data.total);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not load sessions."));
    } finally {
      setLoading(false);
    }
  }, [search, role, instituteId, showError]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function revoke(session: AdminSession) {
    const ok = await confirmAction(
      `Sign out this session for ${session.user_email}? The device will need to log in again.`,
      { title: "Sign out session", confirmText: "Sign out", variant: "danger" },
    );
    if (!ok) return;
    setBusyId(session.id);
    try {
      await apiClient.delete(`/super-admin/sessions/${session.id}`);
      setRows((current) => current.filter((row) => row.id !== session.id));
      setTotal((current) => Math.max(0, current - 1));
      showSuccess(`Signed out ${session.user_email}.`);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not sign out this session."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="all-sessions">
      <PageHeader
        eyebrow="Security"
        title="All active sessions"
        subtitle="Every signed-in device across every institute, with an approximate location for each."
      />

      <div className="all-sessions-filters">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
        <select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filter by role">
          {ROLE_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={instituteId}
          onChange={(event) => setInstituteId(event.target.value)}
          aria-label="Filter by institute"
        >
          <option value="">All institutes</option>
          {institutes.map((institute) => (
            <option key={institute.id} value={institute.id}>
              {institute.name}
            </option>
          ))}
        </select>
        <span className="hint all-sessions-count">{total.toLocaleString("en-IN")} sessions</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="empty-message">No active sessions match.</p>
      ) : (
        <div className="table-wrap data-table-card">
          <table className="data-table responsive-data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Institute</th>
                <th>Device</th>
                <th>Location</th>
                <th>Signed in</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((session) => {
                const href = mapsHref(session.location);
                return (
                  <tr key={session.id}>
                    <td data-label="User">
                      <div className="all-sessions-user">
                        <strong>{session.user_name}</strong>
                        <span>{session.user_email}</span>
                      </div>
                    </td>
                    <td data-label="Role">{session.role && <Badge tone="gray">{session.role}</Badge>}</td>
                    <td data-label="Institute">{session.institute_name ?? "—"}</td>
                    <td data-label="Device">{session.device}</td>
                    <td data-label="Location">
                      <div className="all-sessions-location">
                        <span>{session.location.label}</span>
                        {session.ip_address && <small>{session.ip_address}</small>}
                        {href && (
                          <a href={href} target="_blank" rel="noopener noreferrer">
                            View on map
                          </a>
                        )}
                      </div>
                    </td>
                    <td data-label="Signed in">{formatDate(session.created_at)}</td>
                    <td data-label="Actions">
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        loading={busyId === session.id}
                        disabled={busyId !== null}
                        onClick={() => revoke(session)}
                      >
                        Sign out
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
