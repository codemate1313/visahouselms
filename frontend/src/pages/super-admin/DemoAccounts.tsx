import { type FormEvent, useCallback, useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiClient } from "../../api/client";
import { extractErrorMessage } from "../../api/errors";
import { SearchableSelect } from "../../components/SearchableSelect";

interface DemoRow {
  id: number;
  institute_id: number;
  institute_name: string;
  duration_days: number;
  course_limit: number;
  test_limit: number;
  expires_at: string;
  converted_at: string | null;
  state: "active" | "expired" | "converted";
  days_remaining: number | null;
  created_at: string;
}

interface CreatedDemo {
  admin_email: string;
  admin_temp_password: string;
}

const STATE_BADGES: Record<string, string> = {
  active: "badge-green",
  expired: "badge-red",
  converted: "badge-amber",
};

const EMPTY_FORM = {
  name: "",
  admin_email: "",
  admin_first_name: "",
  admin_last_name: "",
  duration_days: "14",
  course_limit: "2",
  test_limit: "5",
};

export function DemoAccounts() {
  const [rows, setRows] = useState<DemoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedDemo | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<DemoRow[]>("/super-admin/demo-accounts");
      setRows(data);
    } catch {
      setError("Failed to load demo accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const matchesSearch = !query || row.institute_name.toLowerCase().includes(query);
    const matchesState = !stateFilter || row.state === stateFilter;
    return matchesSearch && matchesState;
  });

  function set(field: keyof typeof EMPTY_FORM) {
    return (event: { target: { value: string } }) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { data } = await apiClient.post("/super-admin/demo-accounts", {
        name: form.name,
        admin_email: form.admin_email,
        admin_first_name: form.admin_first_name,
        admin_last_name: form.admin_last_name,
        duration_days: Number(form.duration_days),
        course_limit: Number(form.course_limit),
        test_limit: Number(form.test_limit),
      });
      setCreated({ admin_email: data.admin_email, admin_temp_password: data.admin_temp_password });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to create demo account."));
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    await navigator.clipboard.writeText(created.admin_temp_password);
    setCopied(true);
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFillColor(185, 28, 43);
    doc.rect(0, 0, 297, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("IELTS LMS — Institute Demo Accounts Report", 14, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 220, 13);

    autoTable(doc, {
      startY: 26,
      head: [["#", "Institute Name", "Limits (Courses/Tests)", "Expires", "Days Remaining", "State"]],
      body: filteredRows.map((row, i) => [
        i + 1,
        row.institute_name,
        `${row.course_limit} courses / ${row.test_limit} tests`,
        new Date(row.expires_at).toLocaleDateString("en-GB"),
        row.days_remaining ?? "—",
        row.state.toUpperCase(),
      ]),
      styles: { fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`demo-accounts-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    const wsData = [
      ["#", "Institute Name", "Course Limit", "Test Limit", "Duration (Days)", "Expires At", "Days Remaining", "State"],
      ...filteredRows.map((row, i) => [
        i + 1,
        row.institute_name,
        row.course_limit,
        row.test_limit,
        row.duration_days,
        new Date(row.expires_at).toLocaleDateString("en-GB"),
        row.days_remaining ?? 0,
        row.state,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Demo Accounts");
    XLSX.writeFile(wb, `demo-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Institute Demo Accounts</h1>
          <p className="page-subtitle">Manage trial demo environments for prospective institutes.</p>
        </div>
        <button
          type="button"
          className={showForm ? "secondary-link-btn" : "button-link"}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancel" : "+ New Demo"}
        </button>
      </div>

      {created && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <h2>Demo account created</h2>
            <p className="hint">
              Share these credentials with the prospect now — the password won't be shown again.
            </p>
            <div className="credential-row">
              <span>Email</span>
              <code>{created.admin_email}</code>
            </div>
            <div className="credential-row">
              <span>Temporary password</span>
              <code>{created.admin_temp_password}</code>
            </div>
            <div className="form-actions">
              <button type="button" onClick={copyPassword}>{copied ? "Copied!" : "Copy password"}</button>
              <button type="button" onClick={() => setCreated(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form className="form-card wide onboarding-section-card" onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <h2>New Demo Account</h2>
          <p className="hint" style={{ marginBottom: 16 }}>Set up a temporary trial environment.</p>

          <label htmlFor="name">Prospective institute name</label>
          <input id="name" value={form.name} onChange={set("name")} required placeholder="e.g. Acme IELTS Prep" />

          <h3 className="section-subheading" style={{ marginTop: 20 }}>Demo Administrator</h3>
          <label htmlFor="admin_email">Admin email</label>
          <input id="admin_email" type="email" value={form.admin_email} onChange={set("admin_email")} required placeholder="admin@prospect.com" />
          
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div>
              <label htmlFor="admin_first_name">First name</label>
              <input id="admin_first_name" value={form.admin_first_name} onChange={set("admin_first_name")} required />
            </div>
            <div>
              <label htmlFor="admin_last_name">Last name</label>
              <input id="admin_last_name" value={form.admin_last_name} onChange={set("admin_last_name")} required />
            </div>
            <div>
              <label htmlFor="duration_days">Duration (days)</label>
              <input id="duration_days" type="number" min="1" value={form.duration_days} onChange={set("duration_days")} required />
            </div>
            <div>
              <label htmlFor="course_limit">Course limit</label>
              <input id="course_limit" type="number" min="0" value={form.course_limit} onChange={set("course_limit")} required />
            </div>
            <div>
              <label htmlFor="test_limit">Test limit</label>
              <input id="test_limit" type="number" min="0" value={form.test_limit} onChange={set("test_limit")} required />
            </div>
          </div>

          {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}

          <div className="form-actions" style={{ marginTop: 20 }}>
            <button type="submit" className="primary-submit-btn" disabled={saving}>
              {saving ? "Creating..." : "Create Demo Account"}
            </button>
          </div>
        </form>
      )}

      <div className="filter-bar institutes-filter-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search demo institute..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="clear-search-btn" onClick={() => setSearch("")} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>

        <SearchableSelect
          options={[
            { value: "", label: "All states" },
            { value: "active", label: "Active" },
            { value: "expired", label: "Expired" },
            { value: "converted", label: "Converted" },
          ]}
          value={stateFilter}
          onChange={(val) => setStateFilter(String(val))}
          placeholder="All states"
          searchable={false}
          className="status-filter-select"
        />

        <div className="export-btn-group">
          <button type="button" className="export-btn export-pdf" onClick={exportPDF} data-tooltip="Export PDF">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="m9 15 3 3 3-3" />
            </svg>
          </button>
          <button type="button" className="export-btn export-excel" onClick={exportExcel} data-tooltip="Export Excel">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M3 9h18" />
              <path d="M3 15h18" />
              <path d="M9 3v18" />
              <path d="M15 3v18" />
            </svg>
          </button>
        </div>

        <div className="filter-result-count">
          Showing <strong>{filteredRows.length}</strong> {filteredRows.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table sleek-institutes-table">
            <thead>
              <tr>
                <th>Institute</th>
                <th>Limits (Courses / Tests)</th>
                <th>Expires</th>
                <th>Days Remaining</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr><td colSpan={5} className="empty-cell">No demo accounts found.</td></tr>
              )}
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="table-item-cell">
                      <div className="table-avatar-tile">
                        {row.institute_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="table-item-title">{row.institute_name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#334155" }}>
                      {row.course_limit} courses / {row.test_limit} tests
                    </span>
                  </td>
                  <td>{new Date(row.expires_at).toLocaleDateString("en-GB")}</td>
                  <td>
                    <strong style={{ fontSize: 13.5, color: (row.days_remaining ?? 0) <= 3 ? "#b91c2b" : "#0f172a" }}>
                      {row.days_remaining ?? "—"}
                    </strong>
                  </td>
                  <td>
                    <span className={`badge ${STATE_BADGES[row.state]}`}>{row.state}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
