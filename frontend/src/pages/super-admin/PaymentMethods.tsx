import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { confirmDelete } from "../../components/confirmDialog";

interface MethodRow {
  id: number;
  name: string;
  is_active: boolean;
}

export function PaymentMethods() {
  const [methods, setMethods] = useState<MethodRow[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<MethodRow[]>("/super-admin/payment-methods");
      setMethods(data);
    } catch {
      setError("Failed to load payment methods.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiClient.post("/super-admin/payment-methods", { name });
      setName("");
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to create payment method."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(method: MethodRow) {
    setError(null);
    const action = method.is_active ? "deactivate" : "reactivate";
    try {
      await apiClient.post(`/super-admin/payment-methods/${method.id}/${action}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to ${action} payment method.`));
    }
  }

  async function remove(method: MethodRow) {
    if (!await confirmDelete(`Are you sure you want to delete payment method "${method.name}"?`, "Delete Payment Method")) return;
    setError(null);
    try {
      await apiClient.delete(`/super-admin/payment-methods/${method.id}`);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to delete payment method."));
    }
  }

  return (
    <div>
      <h1>Payment Methods</h1>
      <p className="hint" style={{ marginBottom: 20 }}>
        Modes of payment offered when recording a payment (Cash, UPI, Bank Transfer, etc.).
      </p>

      <form className="form-card" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
        <label htmlFor="name">New method name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Crypto" required />
        {error && <p className="error-text">{error}</p>}
        <div className="form-actions">
          <button type="submit" disabled={saving}>{saving ? "Adding..." : "Add Method"}</button>
        </div>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {methods.length === 0 && (
              <tr><td colSpan={3} className="empty-cell">No payment methods yet.</td></tr>
            )}
            {methods.map((method) => (
              <tr key={method.id}>
                <td>{method.name}</td>
                <td>
                  <span className={`badge ${method.is_active ? "badge-green" : "badge-gray"}`}>
                    {method.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="table-actions">
                  <button onClick={() => toggleActive(method)}>
                    {method.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                  <button className="danger" onClick={() => remove(method)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
