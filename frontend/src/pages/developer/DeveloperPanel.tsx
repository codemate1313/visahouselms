import { type FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { SuperAdminAccount } from "@/api/types";
import { PasswordInput } from "@/components/PasswordInput";
import { Button, Card } from "@/components/ui";
import { startImpersonation } from "@/utils/impersonate";
import "./DeveloperPanel.css";

const developerSlug = import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || "vh-control-9f4c2a";
const developerApiBase = `/developer/${developerSlug}`;
type ElevatedAccountType = "developer" | "super_admin_owner";

interface ElevatedAccountForm {
  accountType: ElevatedAccountType;
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

interface ManagedAccountCreated extends SuperAdminAccount {
  temporary_password: string;
}

interface PasswordResetResponse {
  temporary_password: string;
}

interface CredentialNotice {
  title: string;
  email: string;
  password: string;
}

const emptyForm: ElevatedAccountForm = {
  accountType: "developer",
  first_name: "",
  last_name: "",
  email: "",
  password: "",
};

export function DeveloperPanel() {
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ElevatedAccountForm>(emptyForm);
  const [credentialNotice, setCredentialNotice] = useState<CredentialNotice | null>(null);
  const [resettingAccountId, setResettingAccountId] = useState<number | null>(null);

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

  async function toggleForceReset(account: SuperAdminAccount) {
    setError(null);
    setCreateNotice(null);
    try {
      await apiClient.post(`${developerApiBase}/accounts/${account.id}/force-password-reset`, {
        enabled: !account.force_password_reset,
      });
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to update password reset state."));
    }
  }

  async function viewAs(account: SuperAdminAccount) {
    setError(null);
    setCreateNotice(null);
    try {
      await startImpersonation(account.id);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Could not start view-as."));
    }
  }

  async function createElevatedAccount(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreateNotice(null);
    setCredentialNotice(null);
    setCreating(true);
    try {
      const payload = {
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      };
      if (form.accountType === "developer") {
        const { data } = await apiClient.post<ManagedAccountCreated>(`${developerApiBase}/developers`, {
          ...payload,
          is_developer_verified: true,
        });
        setCreateNotice("Developer account created.");
        setCredentialNotice({
          title: "Developer account created",
          email: data.email,
          password: data.temporary_password,
        });
      } else {
        const { data } = await apiClient.post<ManagedAccountCreated>(`${developerApiBase}/super-admins`, {
          ...payload,
          can_view_monetary_analytics: true,
        });
        setCreateNotice("Super Admin Owner account created.");
        setCredentialNotice({
          title: "Super Admin Owner account created",
          email: data.email,
          password: data.temporary_password,
        });
      }
      setForm(emptyForm);
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to create elevated account."));
    } finally {
      setCreating(false);
    }
  }

  async function resetPassword(account: SuperAdminAccount) {
    setError(null);
    setCreateNotice(null);
    setCredentialNotice(null);
    setResettingAccountId(account.id);
    try {
      const { data } = await apiClient.post<PasswordResetResponse>(`${developerApiBase}/accounts/${account.id}/reset-password`);
      setCredentialNotice({
        title: "Password reset complete",
        email: account.email,
        password: data.temporary_password,
      });
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to reset account password."));
    } finally {
      setResettingAccountId(null);
    }
  }

  return (
    <div className="developer-portal-container">
      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="grid">
        <Card className="developer-card">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" x2="19" y1="8" y2="14"/>
              <line x1="22" x2="16" y1="11" y2="11"/>
            </svg>
            Create Elevated Account
          </h2>
          <p className="muted-text">Create a verified Developer or a Super Admin Owner account from the developer workspace. Every creation is audited.</p>

          <form className="developer-create-form" onSubmit={createElevatedAccount}>
            <div className="developer-segmented-control">
              <button
                type="button"
                className={form.accountType === "developer" ? "active" : ""}
                onClick={() => setForm({ ...form, accountType: "developer" })}
              >
                Developer
              </button>
              <button
                type="button"
                className={form.accountType === "super_admin_owner" ? "active" : ""}
                onClick={() => setForm({ ...form, accountType: "super_admin_owner" })}
              >
                SA Owner
              </button>
            </div>

            <div className="developer-create-grid">
              <label>
                First name
                <input
                  required
                  value={form.first_name}
                  onChange={(event) => setForm({ ...form, first_name: event.target.value })}
                />
              </label>
              <label>
                Last name
                <input
                  required
                  value={form.last_name}
                  onChange={(event) => setForm({ ...form, last_name: event.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </label>
              <label>
                Password
                <PasswordInput
                  required
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  minLength={8}
                />
              </label>
            </div>

            {createNotice && <p className="success-text">{createNotice}</p>}
            {credentialNotice && (
              <div className="developer-credential-panel">
                <strong>{credentialNotice.title}</strong>
                <dl>
                  <div>
                    <dt>Email</dt>
                    <dd>{credentialNotice.email}</dd>
                  </div>
                  <div>
                    <dt>Password</dt>
                    <dd>{credentialNotice.password}</dd>
                  </div>
                </dl>
              </div>
            )}
            <div className="developer-create-actions">
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : `Create ${form.accountType === "developer" ? "Developer" : "SA Owner"}`}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="developer-card">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Account Authority
          </h2>
          <p className="muted-text">The developer layer can inspect elevated accounts, create audited elevated accounts, require password resets, and open read-only view-as sessions.</p>
          
          {loading ? (
            <p>Loading accounts...</p>
          ) : (
            <div className="dev-table-wrap">
              <table className="dev-data-table">
                <thead>
                  <tr>
                    <th>ID</th>
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
                      <td style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", fontWeight: 700 }}>
                        #{account.id}
                      </td>
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
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                          <Button
                            size="sm"
                            className={account.force_password_reset ? "dev-btn-reset-active" : "dev-btn-reset"}
                            onClick={() => void toggleForceReset(account)}
                          >
                            {account.force_password_reset ? "Clear reset" : "Require reset"}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={resettingAccountId === account.id}
                            onClick={() => void resetPassword(account)}
                          >
                            {resettingAccountId === account.id ? "Resetting..." : "Reset password"}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => void viewAs(account)}>
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
