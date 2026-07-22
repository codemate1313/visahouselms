import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiClient } from "../../api/client";
import { Icon } from "../../components/icons";
import { SearchableSelect } from "../../components/SearchableSelect";

interface OnboardingRow {
  id: number;
  name: string;
  contact_email: string | null;
  onboarding_status: "draft" | "published";
  agreed_amount: string;
  agreement_currency: string;
  payment: { amount_paid: string; status: string } | null;
  student_limit: number;
  staff_limit: number;
  course_count: number;
  member_count: number;
  created_at: string;
}

export function InstituteOnboardings() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<OnboardingRow[]>("/super-admin/onboarding");
      setRows(data);
    } catch {
      // handled silently or empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      !query ||
      row.name.toLowerCase().includes(query) ||
      Boolean(row.contact_email?.toLowerCase().includes(query));

    const matchesStatus = !statusFilter || row.onboarding_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Header block
    doc.setFillColor(185, 28, 43);
    doc.rect(0, 0, 297, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("IELTS LMS — Institute Onboarding Report", 14, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 220, 13);

    autoTable(doc, {
      startY: 26,
      head: [["#", "Institute", "Contact Email", "Agreement", "Payment", "Allocation", "Courses", "Status"]],
      body: filteredRows.map((row, i) => [
        i + 1,
        row.name,
        row.contact_email ?? "—",
        `${row.agreement_currency || "INR"} ${Number(row.agreed_amount || 0).toLocaleString("en-IN")}`,
        row.payment
          ? `${row.agreement_currency || "INR"} ${Number(row.payment.amount_paid || 0).toLocaleString("en-IN")} (${row.payment.status || "paid"})`
          : "Not recorded",
        `${row.student_limit} students / ${row.staff_limit} staff (${row.member_count} accounts)`,
        row.course_count,
        row.onboarding_status === "published" ? "Published" : "Draft",
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 4,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 9,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        2: { cellWidth: 50 },
      },
    });

    doc.save(`institute-onboardings-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    const wsData = [
      ["#", "Institute Name", "Contact Email", "Agreed Amount", "Currency", "Payment Paid", "Payment Status", "Student Limit", "Staff Limit", "Issued Accounts", "Courses Count", "Onboarding Status", "Created At"],
      ...filteredRows.map((row, i) => [
        i + 1,
        row.name,
        row.contact_email ?? "",
        row.agreed_amount || "0",
        row.agreement_currency || "INR",
        row.payment?.amount_paid || "0",
        row.payment?.status || "pending",
        row.student_limit,
        row.staff_limit,
        row.member_count,
        row.course_count,
        row.onboarding_status,
        new Date(row.created_at).toLocaleDateString(),
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [
      { wch: 5 }, { wch: 28 }, { wch: 32 }, { wch: 16 },
      { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Onboardings");
    XLSX.writeFile(wb, `institute-onboardings-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Institute Onboarding</h1>
          <p className="page-subtitle">Manage physical agreements from first payment through portal publication.</p>
        </div>
        <Link className="button-link" to="/super-admin/onboarding/new">
          Onboard institute
        </Link>
      </div>

      <div className="filter-bar institutes-filter-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="search-icon">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search institute name or email..."
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
            { value: "", label: "All statuses" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
          ]}
          value={statusFilter}
          onChange={(val) => setStatusFilter(String(val))}
          placeholder="All statuses"
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
                <th>Agreement</th>
                <th>Payment</th>
                <th>Allocation</th>
                <th>Courses</th>
                <th>Status</th>
                <th className="table-actions-heading" style={{ textAlign: "right", paddingRight: 24 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!filteredRows.length ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    No institute onboardings found.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="table-item-cell">
                        <div className="table-avatar-tile">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="table-item-details">
                          <span className="table-item-title">{row.name}</span>
                          <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "#94a3b8" }}>
                            {row.contact_email || "No contact email"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong style={{ fontSize: 13.5 }}>
                        {row.agreement_currency || "INR"} {Number(row.agreed_amount || 0).toLocaleString("en-IN")}
                      </strong>
                    </td>
                    <td>
                      <div className="table-item-details">
                        <span className="table-item-title" style={{ fontSize: 13, fontWeight: 500 }}>
                          {row.payment ? `${row.agreement_currency || "INR"} ${Number(row.payment.amount_paid || 0).toLocaleString("en-IN")}` : "Not recorded"}
                        </span>
                        <span className="table-item-subtitle" style={{ fontSize: 11.5, color: row.payment?.status === "paid" ? "#16a34a" : "#94a3b8" }}>
                          {row.payment?.status || "pending"}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="table-item-details">
                        <span className="table-item-title" style={{ fontSize: 13, fontWeight: 500 }}>
                          {row.student_limit} students / {row.staff_limit} staff
                        </span>
                        <span className="table-item-subtitle" style={{ fontSize: 11.5, color: "#94a3b8" }}>
                          {row.member_count} accounts issued
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray" style={{ fontWeight: 600 }}>
                        {row.course_count}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${row.onboarding_status === "published" ? "badge-green" : "badge-amber"}`}>
                        {row.onboarding_status === "published" ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="table-actions" style={{ paddingRight: 24 }}>
                      <Link
                        className="action-btn-icon action-edit"
                        to={`/super-admin/onboarding/${row.id}`}
                        data-tooltip={row.onboarding_status === "draft" ? "Continue Onboarding" : "View Details"}
                      >
                        <Icon name={row.onboarding_status === "draft" ? "edit" : "overview"} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
