import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import type { SuperAdminAccount } from "../../api/types";
import { ConfirmModal } from "../../components/ConfirmModal";
import { useAuthStore } from "../../store/authStore";

export function AccountsList() {
  const currentUser = useAuthStore((state) => state.user);
  const [accounts, setAccounts] = useState<SuperAdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<SuperAdminAccount | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    try {
      const { data } = await apiClient.get<SuperAdminAccount[]>("/super-admin/accounts");
      setAccounts(data);
      setError(null);
    } catch {
      setError("Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function handleToggleActive(account: SuperAdminAccount) {
    setError(null);
    const action = account.is_active ? "deactivate" : "reactivate";
    try {
      await apiClient.post(`/super-admin/accounts/${account.id}/${action}`);
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to ${action} account.`));
    }
  }

  async function handleForceReset(account: SuperAdminAccount) {
    setError(null);
    try {
      await apiClient.post(`/super-admin/accounts/${account.id}/force-password-reset`, {
        enabled: !account.force_password_reset,
      });
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to update password-reset requirement."));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingAccount) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/accounts/${deletingAccount.id}`);
      setDeletingAccount(null);
      await loadAccounts();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete account."));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Super Admin Accounts</h1>
        <Link to="/super-admin/accounts/new" className="button-link">
          + New Account
        </Link>
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>
                  {account.first_name} {account.last_name}
                  {currentUser?.id === account.id && <span className="badge">you</span>}
                  {account.force_password_reset && (
                    <span className="badge badge-amber">reset required</span>
                  )}
                </td>
                <td>{account.email}</td>
                <td>
                  <span className={`badge ${account.is_active ? "badge-green" : "badge-gray"}`}>
                    {account.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>{new Date(account.created_at).toLocaleDateString()}</td>
                <td className="table-actions">
                  <Link to={`/super-admin/accounts/${account.id}`}>Edit</Link>
                  <button onClick={() => handleForceReset(account)}>
                    {account.force_password_reset ? "Clear reset" : "Require reset"}
                  </button>
                  <button onClick={() => handleToggleActive(account)}>
                    {account.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                  <button onClick={() => setDeletingAccount(account)} className="danger">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmModal
        isOpen={Boolean(deletingAccount)}
        title="Delete Admin Account"
        message={deletingAccount ? `Are you sure you want to delete account "${deletingAccount.email}"? This action cannot be undone.` : ""}
        confirmText="Delete Account"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingAccount(null)}
      />
    </div>
  );
}

