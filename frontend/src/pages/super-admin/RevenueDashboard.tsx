import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiClient } from "../../api/client";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";
import { Icon } from "../../components/icons";
import { BarChart } from "../../components/charts/BarChart";
import { SearchableSelect } from "../../components/SearchableSelect";

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

  function formatCurrency(amountStr: string | number) {
    const num = Number(amountStr) || 0;
    return `INR ${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function exportPDF() {
    if (!summary) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Header block
    doc.setFillColor(185, 28, 43);
    doc.rect(0, 0, 297, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("IELTS LMS — Financial & Revenue Summary Report", 14, 13);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleString()}`, 215, 13);

    // KPI Summary
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("KPI Overview:", 14, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Total Revenue: ${formatCurrency(summary.total_revenue)}   |   B2B: ${formatCurrency(summary.b2b_revenue)}   |   B2C: ${formatCurrency(summary.b2c_revenue)}   |   Total Due: ${formatCurrency(summary.total_due)}   |   Transactions: ${summary.transaction_count}`,
      14,
      34
    );

    autoTable(doc, {
      startY: 40,
      head: [["#", "Institute Name", "Revenue Amount", "Transaction Count"]],
      body: summary.by_institute.map((row, i) => [
        i + 1,
        row.institute_name,
        formatCurrency(row.total),
        row.count,
      ]),
      styles: { fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`revenue-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function exportExcel() {
    if (!summary) return;
    const wsData = [
      ["Metric Summary"],
      ["Total Revenue", formatCurrency(summary.total_revenue)],
      ["B2B (Institutes)", formatCurrency(summary.b2b_revenue)],
      ["B2C (Direct)", formatCurrency(summary.b2c_revenue)],
      ["Total Due", formatCurrency(summary.total_due)],
      ["Total Transactions", summary.transaction_count],
      [],
      ["Revenue By Institute"],
      ["#", "Institute Name", "Revenue Total", "Transactions"],
      ...summary.by_institute.map((row, i) => [
        i + 1,
        row.institute_name,
        row.total,
        row.count,
      ]),
      [],
      ["Revenue By Month"],
      ["#", "Month", "Revenue Total", "Transactions"],
      ...summary.by_month.map((row, i) => [
        i + 1,
        row.month,
        row.total,
        row.count,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 15 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Revenue Summary");
    XLSX.writeFile(wb, `revenue-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Revenue Analytics</h1>
          <p className="page-subtitle">Financial performance breakdown across B2B institutes and B2C direct students.</p>
        </div>
      </div>

      <div className="filter-bar institutes-filter-bar">
        <SearchableSelect
          options={[
            { value: "", label: "All institutes" },
            ...institutes.map((i) => ({ value: String(i.id), label: i.name })),
          ]}
          value={instituteFilter}
          onChange={(val) => setInstituteFilter(String(val))}
          placeholder="All institutes"
          searchPlaceholder="Search institute..."
          className="status-filter-select"
        />

        <div className="date-filter-wrap">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="date-input-field"
            aria-label="From Date"
          />
          <span className="date-sep-text">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="date-input-field"
            aria-label="To Date"
          />
        </div>

        {(instituteFilter || dateFrom || dateTo) && (
          <button
            type="button"
            className="clear-search-btn reset-filters-btn"
            onClick={() => {
              setInstituteFilter("");
              setDateFrom("");
              setDateTo("");
            }}
          >
            Reset filters
          </button>
        )}

        <div className="export-btn-group">
          <button type="button" className="export-btn export-pdf" onClick={exportPDF} data-tooltip="Export PDF">
            <Icon name="filePdf" />
          </button>
          <button type="button" className="export-btn export-excel" onClick={exportExcel} data-tooltip="Export Excel">
            <Icon name="spreadsheet" />
          </button>
        </div>

        <div className="filter-result-count">
          Showing <strong>{summary.transaction_count}</strong> {summary.transaction_count === 1 ? "transaction" : "transactions"}
        </div>
      </div>

      <div className="stat-tile-row revenue-kpi-row">
        <div className="stat-tile revenue-kpi-tile">
          <p className="stat-label">Total Revenue</p>
          <p className="stat-value">{formatCurrency(summary.total_revenue)}</p>
        </div>
        <div className="stat-tile revenue-kpi-tile">
          <p className="stat-label">B2B (Institutes)</p>
          <p className="stat-value">{formatCurrency(summary.b2b_revenue)}</p>
        </div>
        <div className="stat-tile revenue-kpi-tile">
          <p className="stat-label">B2C (Direct)</p>
          <p className="stat-value">{formatCurrency(summary.b2c_revenue)}</p>
        </div>
        <div className="stat-tile revenue-kpi-tile">
          <p className="stat-label">Total Due</p>
          <p className="stat-value due-text">{formatCurrency(summary.total_due)}</p>
        </div>
        <div className="stat-tile revenue-kpi-tile">
          <p className="stat-label">Transactions</p>
          <p className="stat-value">{summary.transaction_count}</p>
        </div>
      </div>

      <div className="revenue-tables-grid">
        <BarChart
          data={summary.by_institute.map((row) => ({
            label: row.institute_name,
            value: Number(row.total) || 0,
            subtext: `${row.count} txns`,
          }))}
          orientation="horizontal"
          formatValue={(val) => formatCurrency(String(val))}
          ariaLabel="Revenue by Institute"
          emptyMessage="No revenue recorded yet."
        />

        <BarChart
          data={summary.by_month.map((row) => ({
            label: row.month,
            value: Number(row.total) || 0,
            subtext: `${row.count} txns`,
          }))}
          orientation="vertical"
          formatValue={(val) => formatCurrency(String(val))}
          ariaLabel="Revenue by Month"
          emptyMessage="No monthly data."
        />
      </div>

      <CollapsiblePanel
        className="table-card-block"
        title="Outstanding Dues"
        description="Invoices with remaining due amounts."
        badge={<span className="count-chip">{summary.dues.length}</span>}
      >
        <div className="table-wrap">
          <table className="data-table sleek-institutes-table">
            <thead>
              <tr>
                <th>Institute</th>
                <th>Invoice</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Due Amount</th>
                <th className="table-actions-heading" style={{ textAlign: "center", width: 100, minWidth: 100 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {summary.dues.length === 0 && (
                <tr><td colSpan={6} className="empty-cell">No outstanding dues. All accounts clear!</td></tr>
              )}
              {summary.dues.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="table-item-title">{row.institute_name ?? "Direct Student"}</span>
                  </td>
                  <td>
                    <span className="table-item-subtitle" style={{ fontSize: 12.5, color: "var(--slate-500)" }}>
                      {row.invoice_number ?? "N/A"}
                    </span>
                  </td>
                  <td>{formatCurrency(row.final_amount)}</td>
                  <td>{formatCurrency(row.amount_paid)}</td>
                  <td>
                    <span className="badge badge-red" style={{ fontWeight: 700 }}>
                      {formatCurrency(row.due_amount)}
                    </span>
                  </td>
                  <td className="table-actions" style={{ justifyContent: "center" }}>
                    <Link
                      className="action-btn-icon action-edit"
                      to={`/super-admin/payments/${row.id}/invoice`}
                      data-tooltip="View Invoice"
                    >
                      <Icon name="billings" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
