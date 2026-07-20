import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";

interface InstituteRow {
  id: number;
  name: string;
}

interface InstituteBreakdown {
  institute_id: number;
  institute_name: string;
  total: string;
  count: number;
}

interface MonthBreakdown {
  month: string;
  total: string;
  count: number;
}

interface DueRow {
  id: number;
  institute_name: string | null;
  invoice_number: string | null;
  final_amount: string;
  amount_paid: string;
  due_amount: string;
  created_at: string;
}

interface Summary {
  total_revenue: string;
  b2b_revenue: string;
  b2c_revenue: string;
  total_due: string;
  transaction_count: number;
  by_institute: InstituteBreakdown[];
  by_month: MonthBreakdown[];
  dues: DueRow[];
}

export function RevenueDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [institutes, setInstitutes] = useState<InstituteRow[]>([]);

  const [instituteFilter, setInstituteFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (instituteFilter) params.set("institute_id", instituteFilter);
      if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00`);
      if (dateTo) params.set("date_to", `${dateTo}T23:59:59`);
      const { data } = await apiClient.get<Summary>(`/super-admin/revenue/summary?${params}`);
      setSummary(data);
      setError(null);
    } catch {
      setError("Failed to load revenue summary.");
    }
  }, [instituteFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiClient.get("/super-admin/institutes").then(({ data }) => setInstitutes(data));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return <p>Loading...</p>;

  return (
    <div>
      <h1>Revenue</h1>

      <div className="filter-bar">
        <select value={instituteFilter} onChange={(e) => setInstituteFilter(e.target.value)}>
          <option value="">All institutes</option>
          {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <span className="hint">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <div className="stat-tile-row">
        <div className="stat-tile">
          <p className="stat-label">Total revenue</p>
          <p className="stat-value">₹{summary.total_revenue}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">B2B (institutes)</p>
          <p className="stat-value">₹{summary.b2b_revenue}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">B2C (direct)</p>
          <p className="stat-value">₹{summary.b2c_revenue}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Total due</p>
          <p className="stat-value due-text">₹{summary.total_due}</p>
        </div>
        <div className="stat-tile">
          <p className="stat-label">Transactions</p>
          <p className="stat-value">{summary.transaction_count}</p>
        </div>
      </div>

      <div className="revenue-tables">
        <div>
          <h2 className="section-title">By institute</h2>
          <table className="data-table">
            <thead><tr><th>Institute</th><th>Revenue</th><th>Transactions</th></tr></thead>
            <tbody>
              {summary.by_institute.length === 0 && (
                <tr><td colSpan={3} className="empty-cell">No revenue yet.</td></tr>
              )}
              {summary.by_institute.map((row) => (
                <tr key={row.institute_id}>
                  <td>{row.institute_name}</td>
                  <td>₹{row.total}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="section-title">By month</h2>
          <table className="data-table">
            <thead><tr><th>Month</th><th>Revenue</th><th>Transactions</th></tr></thead>
            <tbody>
              {summary.by_month.length === 0 && (
                <tr><td colSpan={3} className="empty-cell">No revenue yet.</td></tr>
              )}
              {summary.by_month.map((row) => (
                <tr key={row.month}>
                  <td>{row.month}</td>
                  <td>₹{row.total}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="section-title" style={{ marginTop: 28 }}>Outstanding dues</h2>
      <table className="data-table">
        <thead>
          <tr><th>Institute</th><th>Invoice</th><th>Total</th><th>Paid</th><th>Due</th><th></th></tr>
        </thead>
        <tbody>
          {summary.dues.length === 0 && (
            <tr><td colSpan={6} className="empty-cell">No outstanding dues.</td></tr>
          )}
          {summary.dues.map((row) => (
            <tr key={row.id}>
              <td>{row.institute_name ?? "—"}</td>
              <td>{row.invoice_number ?? "—"}</td>
              <td>₹{row.final_amount}</td>
              <td>₹{row.amount_paid}</td>
              <td className="due-text">₹{row.due_amount}</td>
              <td className="table-actions">
                <Link to={`/super-admin/payments/${row.id}/invoice`}>Invoice</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
