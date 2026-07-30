import { type FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { SuperAdminAccount } from "@/api/types";
import { Button, Card, Checkbox, Input, RequiredMark, SearchableSelect } from "@/components/ui";
import "./DeveloperPanel.css";

const developerSlug = import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || "vh-control-9f4c2a";
const developerApiBase = `/developer/${developerSlug}`;

export function DeveloperPanel() {
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([]);
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
    <div className="developer-portal-container">
      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="grid two-cols">
        <Card className="developer-card">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Account Authority
          </h2>
          <p className="muted-text">Owner accounts are immutable from this layer. Only verified developer accounts can open this panel.</p>
          
          {loading ? (
            <p>Loading accounts...</p>
          ) : (
            <div className="dev-table-wrap">
              <table className="dev-data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Controls</th>
                  </tr>
                </thead>
                <tbody>
                  {[...grouped.owners, ...grouped.developers, ...grouped.superAdmins].map((account) => (
                    <tr key={account.id}>
                      <td>
                        <strong style={{ display: "block", marginBottom: "4px" }}>
                          {account.first_name} {account.last_name}
                        </strong>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          {account.is_owner && <span className="dev-badge dev-badge-owner">Owner</span>}
                          {account.is_developer_verified && <span className="dev-badge dev-badge-verified">Verified</span>}
                        </div>
                      </td>
                      <td>{account.email}</td>
                      <td style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)" }}>
                        {account.role_name ?? "SUPER_ADMIN"}
                      </td>
                      <td>
                        <span className={`dev-badge ${account.is_active ? "dev-badge-active" : "dev-badge-inactive"}`}>
                          {account.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        {account.is_owner ? (
                          <span className="dev-badge dev-badge-locked">Locked</span>
                        ) : (
                          <Button
                            size="sm"
                            className={account.force_password_reset ? "dev-btn-reset-active" : "dev-btn-reset"}
                            onClick={() => void toggleForceReset(account)}
                          >
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

        <Card className="developer-card">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <line x1="20" y1="8" x2="20" y2="14"/>
              <line x1="23" y1="11" x2="17" y2="11"/>
            </svg>
            Create Controlled Account
          </h2>
          <form className="dev-form" onSubmit={createAccount}>
            <div className="dev-form-group">
              <label>Account type<RequiredMark /></label>
              <SearchableSelect
                className="dev-select-control"
                options={[
                  { value: "super-admin", label: "Super Admin" },
                  { value: "developer", label: "Verified Developer" },
                ]}
                searchable={false}
                value={form.mode}
                onChange={(value) => setForm((current) => ({ ...current, mode: String(value) as "super-admin" | "developer" }))}
              />
            </div>
            
            <Input
              label="Email"
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
            
            <Input
              label="Temporary password"
              required
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            />
            
            <Input
              label="First name"
              required
              value={form.first_name}
              onChange={(event) => setForm((current) => ({ ...current, first_name: event.target.value }))}
            />
            
            <Input
              label="Last name"
              required
              value={form.last_name}
              onChange={(event) => setForm((current) => ({ ...current, last_name: event.target.value }))}
            />
            
            {form.mode === "developer" && (
              <label className="dev-checkbox-container">
                <Checkbox
                  checked={form.is_developer_verified}
                  onChange={(event) => setForm((current) => ({ ...current, is_developer_verified: event.target.checked }))}
                />
                Verified developer access
              </label>
            )}
            
            <Button className="dev-submit-btn" type="submit" disabled={busy}>
              {busy ? "Creating..." : "Create account"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
