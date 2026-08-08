import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { SuperAdminAccount } from "@/api/types";
import { Button, Card } from "@/components/ui";
import { startImpersonation } from "@/utils/impersonate";
import "./DeveloperPanel.css";

const developerSlug = import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || "vh-control-9f4c2a";
const developerApiBase = `/developer/${developerSlug}`;

export function DeveloperPanel() {
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    try {
      await startImpersonation(account.id);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Could not start view-as."));
    }
  }

  return (
    <div className="developer-portal-container">
      {error && <p className="error-text" style={{ marginBottom: 16 }}>{error}</p>}

      <div className="grid">
        <Card className="developer-card">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Account Authority
          </h2>
          <p className="muted-text">The developer layer can inspect elevated accounts, require password resets, and open read-only view-as sessions. Owner, Super Admin, and Developer account creation is intentionally blocked from this panel.</p>
          
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
