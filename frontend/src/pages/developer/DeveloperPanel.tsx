import { type FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { SuperAdminAccount } from "@/api/types";
import { logoutAndRedirectHome } from "@/auth/logout";
import { Button, Card, Input, PageHeader, RequiredMark } from "@/components/ui";
import { DeveloperSettings } from "@/pages/super-admin/DeveloperSettings";
import { useAuthStore } from "@/store/authStore";

const developerSlug = import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || "vh-control-9f4c2a";
const developerApiBase = `/developer/${developerSlug}`;

export function DeveloperPanel() {
  const user = useAuthStore((state) => state.user);
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([]);
  const [activeTab, setActiveTab] = useState<"accounts" | "settings">("accounts");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    mode: "super-admin" as "super-admin" | "developer",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    is_developer_verified: true,
  });

  async function loadAccounts() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<SuperAdminAccount[]>(`${developerApiBase}/accounts`);
      setAccounts(data);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to load protected accounts."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAccounts();
  }, []);

  const grouped = useMemo(() => ({
    owners: accounts.filter((account) => account.is_owner),
    superAdmins: accounts.filter((account) => account.role_name === "SUPER_ADMIN" && !account.is_owner),
    developers: accounts.filter((account) => account.role_name === "DEVELOPER"),
  }), [accounts]);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const endpoint = form.mode === "developer" ? "developers" : "super-admins";
      await apiClient.post(`${developerApiBase}/${endpoint}`, {
        email: form.email.trim().toLowerCase(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        is_developer_verified: form.is_developer_verified,
      });
      setForm((current) => ({ ...current, email: "", password: "", first_name: "", last_name: "" }));
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to create account."));
    } finally {
      setBusy(false);
    }
  }

  async function toggleForceReset(account: SuperAdminAccount) {
    if (account.is_owner) return;
    setError(null);
    try {
      await apiClient.post(`${developerApiBase}/accounts/${account.id}/force-password-reset`, {
        enabled: !account.force_password_reset,
      });
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to update password reset state."));
    }
  }

  return (
    <div className="dashboard super-admin-portal">
      <main className="dashboard-content" style={{ marginLeft: 0, width: "100%" }}>
        <PageHeader
          title="Application Control"
          subtitle={`Verified developer layer. Signed in as ${user?.email ?? "developer"}.`}
          actions={<Button variant="secondary" onClick={() => void logoutAndRedirectHome()}>Logout</Button>}
        />

        <div className="tabs" style={{ marginBottom: 18 }}>
          <button className={activeTab === "accounts" ? "active" : ""} type="button" onClick={() => setActiveTab("accounts")}>Protected accounts</button>
          <button className={activeTab === "settings" ? "active" : ""} type="button" onClick={() => setActiveTab("settings")}>Developer settings</button>
        </div>

        {error && <p className="error-text">{error}</p>}

        {activeTab === "settings" ? (
          <DeveloperSettings />
        ) : (
          <div className="grid two-cols">
            <Card>
              <h2>Account authority</h2>
              <p className="muted-text">Owner accounts are immutable from this layer. Only verified developer accounts can open this panel.</p>
              {loading ? (
                <p>Loading accounts...</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Controls</th></tr>
                    </thead>
                    <tbody>
                      {[...grouped.owners, ...grouped.developers, ...grouped.superAdmins].map((account) => (
                        <tr key={account.id}>
                          <td>
                            <strong>{account.first_name} {account.last_name}</strong>
                            {account.is_owner && <span className="badge badge-red" style={{ marginLeft: 8 }}>Owner</span>}
                            {account.is_developer_verified && <span className="badge badge-blue" style={{ marginLeft: 8 }}>Verified</span>}
                          </td>
                          <td>{account.email}</td>
                          <td>{account.role_name ?? "SUPER_ADMIN"}</td>
                          <td><span className={`badge ${account.is_active ? "badge-green" : "badge-gray"}`}>{account.is_active ? "Active" : "Inactive"}</span></td>
                          <td>
                            {account.is_owner ? (
                              <span className="badge badge-gray">Locked</span>
                            ) : (
                              <Button size="sm" variant="secondary" onClick={() => void toggleForceReset(account)}>
                                {account.force_password_reset ? "Clear reset" : "Require reset"}
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <h2>Create controlled account</h2>
              <form className="stack" onSubmit={createAccount}>
                <label>Account type<RequiredMark /></label>
                <select value={form.mode} onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value as "super-admin" | "developer" }))}>
                  <option value="super-admin">Super Admin</option>
                  <option value="developer">Verified Developer</option>
                </select>
                <Input label="Email" required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                <Input label="Temporary password" required type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
                <Input label="First name" required value={form.first_name} onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))} />
                <Input label="Last name" required value={form.last_name} onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))} />
                {form.mode === "developer" && (
                  <label className="checkbox-row">
                    <input type="checkbox" checked={form.is_developer_verified} onChange={(event) => setForm((current) => ({ ...current, is_developer_verified: event.target.checked }))} />
                    Verified developer access
                  </label>
                )}
                <Button type="submit" disabled={busy}>{busy ? "Creating..." : "Create account"}</Button>
              </form>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
