import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { Badge, Button, PageHeader, SearchInput } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import "./DeveloperUsers.css";

const developerSlug = import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || "vh-control-9f4c2a";

interface DirectoryUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string | null;
  institute_name: string | null;
  is_active: boolean;
  is_owner: boolean;
  created_at: string;
}

interface DirectoryResponse {
  total: number;
  users: DirectoryUser[];
}

/**
 * The whole user base, every tenant, in one list - the developer's cross-cutting
 * view that Super Admin's role-scoped directory is not. Revoke deactivates the
 * account and ends its sessions; both revoke and restore are audited server-side.
 */
export function DeveloperUsers() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  const [rows, setRows] = useState<DirectoryUser[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<DirectoryResponse>(`/developer/${developerSlug}/users`, {
        params: { search: search.trim() || undefined, limit: 100 },
      });
      setRows(data.users);
      setTotal(data.total);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not load the user directory."));
    } finally {
      setLoading(false);
    }
  }, [search, showError]);

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function toggle(user: DirectoryUser) {
    const revoking = user.is_active;
    if (revoking) {
      const ok = await confirmAction(
        `Revoke access for ${user.email}? They will be signed out of every device immediately and cannot log in until restored.`,
        { title: "Revoke access", confirmText: "Revoke access", variant: "danger" },
      );
      if (!ok) return;
    }
    setBusyId(user.id);
    try {
      const action = revoking ? "revoke" : "restore";
      await apiClient.post(`/developer/${developerSlug}/users/${user.id}/${action}`);
      setRows((current) =>
        current.map((row) => (row.id === user.id ? { ...row, is_active: !revoking } : row)),
      );
      showSuccess(revoking ? `Access revoked for ${user.email}.` : `Access restored for ${user.email}.`);
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not change this account's access."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="developer-users">
      <PageHeader
        eyebrow="Platform"
        title="All users"
        subtitle="Every account across every institute. Revoke access to sign someone out and block their login."
      />

      <div className="dev-users-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email…" />
        <span className="hint">{total.toLocaleString("en-IN")} accounts</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="empty-message">No accounts match.</p>
      ) : (
        <div className="dev-users-list">
          {rows.map((user) => (
            <article className="dev-user-row" key={user.id}>
              <div className="dev-user-identity">
                <strong>
                  {user.first_name} {user.last_name}
                </strong>
                <span className="dev-user-email">{user.email}</span>
              </div>
              <div className="dev-user-meta">
                {user.role && <Badge tone="gray">{user.role}</Badge>}
                {user.institute_name && <span className="dev-user-institute">{user.institute_name}</span>}
                <Badge tone={user.is_active ? "green" : "inactive"}>
                  {user.is_active ? "Active" : "Revoked"}
                </Badge>
              </div>
              <div className="dev-user-action">
                {user.is_owner ? (
                  <Badge tone="amber">Owner</Badge>
                ) : (
                  <Button
                    type="button"
                    variant={user.is_active ? "danger" : "primary"}
                    loading={busyId === user.id}
                    disabled={busyId !== null}
                    onClick={() => toggle(user)}
                  >
                    {user.is_active ? "Revoke" : "Restore"}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
