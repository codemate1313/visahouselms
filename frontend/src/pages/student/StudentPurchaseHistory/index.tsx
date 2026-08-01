import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { apiClient } from "@/api/client";
import { PageHeader, SearchableSelect, SearchInput } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useAuthStore } from "@/store/authStore";
import { formatCurrencyAmount } from "@/utils/currency";
import { studentPurchaseHistoryStrings as strings } from "./StudentPurchaseHistory.strings";
import "./StudentPurchaseHistory.css";

interface StudentPayment {
  id: number;
  invoice_number: string | null;
  source: string;
  plan_id: number | null;
  plan_name: string | null;
  validity_days: number | null;
  amount: string;
  discount_amount: string;
  subtotal_amount?: string;
  gst_percentage?: string;
  gst_tax_type?: string;
  gst_amount?: string;
  final_amount: string;
  amount_paid: string;
  due_amount: string;
  currency: string;
  coupon_code: string | null;
  gateway: string;
  gateway_reference: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  subscription: {
    id: number;
    starts_at: string;
    expires_at: string;
    grace_days: number;
    status: string;
  } | null;
}


export function StudentPurchaseHistory() {
  const user = useAuthStore((state) => state.user);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<StudentPayment | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [subStatusFilter, setSubStatusFilter] = useState("all");

  useEffect(() => {
    loadPayments();
  }, []);

  async function loadPayments() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<StudentPayment[]>("/student/payments");
      setPayments(data);
    } catch {
      setError(strings.loadError);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string | null | undefined): string {
    if (!iso) return "N/A";
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function formatPdfCurrency(amount: string | number | null | undefined, currency?: string | null): string {
    const numeric = Number(amount ?? 0);
    const formattedNumber = Number.isFinite(numeric) ? numeric.toLocaleString("en-IN") : String(amount ?? 0);
    const curr = (currency || "INR").trim().toUpperCase();
    const label = curr === "INR" ? "Rs." : curr;
    return `${label} ${formattedNumber}`;
  }

  async function loadLogoDataUrl(): Promise<string | null> {
    try {
      const res = await fetch("/brand/vh-mark-96.png");
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  async function handleDownloadPdf(p: StudentPayment) {
    const doc = new jsPDF();
    const invNum = p.invoice_number || `INV-${p.id}`;
    const logoData = await loadLogoDataUrl();

    // 1. Crimson Header Banner
    doc.setFillColor(163, 28, 40);
    doc.rect(0, 0, 210, 28, "F");

    if (logoData) {
      try {
        doc.addImage(logoData, "PNG", 14, 5, 18, 18);
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.text("VISA HOUSE IELTS LMS", 36, 17);
      } catch {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.text("VISA HOUSE IELTS LMS", 14, 17);
      }
    } else {
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(15);
      doc.setFont("helvetica", "bold");
      doc.text("VISA HOUSE IELTS LMS", 14, 17);
    }

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("TAX INVOICE & RECEIPT", 196, 17, { align: "right" });

    // 2. Invoice Meta Block
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`INVOICE #: ${invNum}`, 14, 40);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Issue Date: ${formatDate(p.created_at)}`, 14, 46);
    doc.text(`Gateway: ${(p.gateway || "Manual").toUpperCase()}`, 14, 51);
    if (p.gateway_reference) {
      doc.setFontSize(7.5);
      doc.text(`Ref / Txn: ${p.gateway_reference}`, 14, 55.5);
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 163, 74);
    doc.text(`STATUS: ${(p.status || "paid").toUpperCase()}`, 196, 40, { align: "right" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    if (p.paid_at) {
      doc.text(`Paid On: ${formatDate(p.paid_at)}`, 196, 46, { align: "right" });
    }

    // 3. Billed To Container Box
    const boxY = p.gateway_reference ? 60 : 57;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, boxY, 182, 25, 3, 3, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, boxY, 182, 25, 3, 3, "S");


    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("BILLED TO STUDENT", 20, boxY + 7);
    doc.text("PURCHASE TYPE", 120, boxY + 7);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    const studentName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Direct Student";
    doc.text(studentName, 20, boxY + 14);
    doc.text(`Direct Student Subscription`, 120, boxY + 14);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Email: ${user?.email || "N/A"}`, 20, boxY + 19);

    // 4. Line Items Table
    const tableHead = [["Item Description", "Validity", "Original Price", "Discount", "Total Paid"]];
    const validityText = p.validity_days ? `${p.validity_days} Days` : "30 Days";
    const planNameText = p.plan_name || "Assessment Access Plan";
    const origPrice = formatPdfCurrency(p.amount, p.currency);
    const discPrice = formatPdfCurrency(p.discount_amount, p.currency);
    const totalPaidPrice = formatPdfCurrency(p.final_amount, p.currency);

    const tableData = [[planNameText, validityText, origPrice, discPrice, totalPaidPrice]];

    autoTable(doc, {
      startY: boxY + 30,

      head: tableHead,
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { textColor: [15, 23, 42], fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 26 },
        2: { cellWidth: 28, halign: "right" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 30, halign: "right" },
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // 5. Subscription Access Validity Box
    if (p.subscription) {
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(14, finalY, 182, 20, 3, 3, "F");
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(14, finalY, 182, 20, 3, 3, "S");

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 101, 52);
      doc.text("SUBSCRIPTION ACCESS PERIOD", 20, finalY + 7);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(21, 128, 61);
      doc.text(
        `Valid From: ${formatDate(p.subscription.starts_at)}   to   ${formatDate(p.subscription.expires_at)}`,
        20,
        finalY + 14
      );
    }

    // 6. Summary Totals Box
    let summaryY = p.subscription ? finalY + 28 : finalY;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Base Subtotal:", 130, summaryY);
    doc.text(origPrice, 196, summaryY, { align: "right" });

    if (parseFloat(p.discount_amount || "0") > 0) {
      summaryY += 6;
      doc.setTextColor(22, 163, 74);
      doc.text("Coupon Discount:", 130, summaryY);
      doc.text(`- ${discPrice}`, 196, summaryY, { align: "right" });
    }

    if (parseFloat(p.gst_amount || "0") > 0) {
      summaryY += 6;
      const gstLabel = p.gst_tax_type === "inclusive" ? `GST Included (${p.gst_percentage}%):` : `GST (${p.gst_percentage}%):`;
      doc.setTextColor(185, 28, 28);
      doc.text(gstLabel, 130, summaryY);
      doc.text(formatPdfCurrency(p.gst_amount, p.currency), 196, summaryY, { align: "right" });
    }

    summaryY += 8;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Total Paid:", 130, summaryY);
    doc.text(totalPaidPrice, 196, summaryY, { align: "right" });


    // 7. Footer Seal
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(148, 163, 184);
    doc.text("Official Tax Receipt issued by Visa House IELTS LMS Platform. Digitally Verified.", 105, 280, {
      align: "center",
    });

    doc.save(`Invoice_${invNum}.pdf`);
  }

  // Filter Logic
  const filteredPayments = payments.filter((p) => {
    const invNum = p.invoice_number || `INV-${p.id}`;
    const planName = p.plan_name || "";
    const matchesSearch =
      !search.trim() ||
      invNum.toLowerCase().includes(search.toLowerCase()) ||
      planName.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === "all" || p.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSubStatus =
      subStatusFilter === "all" ||
      (p.subscription && p.subscription.status.toLowerCase() === subStatusFilter.toLowerCase());

    return matchesSearch && matchesStatus && matchesSubStatus;
  });

  // Calculate Metrics - Only sum successfully PAID transactions for Total Spent
  const totalSpent = payments.reduce((acc, p) => {
    const isPaid = p.status.toLowerCase() === "paid" || p.status.toLowerCase() === "completed";
    return isPaid ? acc + (parseFloat(p.final_amount) || 0) : acc;
  }, 0);
  const activeSub = payments.find((p) => p.subscription && p.subscription.status === "active");


  const statusOptions = [
    { value: "all", label: strings.filters.allStatuses },
    { value: "paid", label: strings.status.paid },
    { value: "pending", label: strings.status.pending },
    { value: "failed", label: strings.status.failed },
  ];

  const subStatusOptions = [
    { value: "all", label: strings.filters.allSubStatuses },
    { value: "active", label: strings.subStatus.active },
    { value: "expired", label: strings.subStatus.expired },
    { value: "grace", label: strings.subStatus.grace },
  ];

  const today: StudentPayment[] = [];
  const yesterday: StudentPayment[] = [];
  const older: StudentPayment[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  filteredPayments.forEach((p) => {
    if (!p.created_at) {
      older.push(p);
      return;
    }
    const date = new Date(p.created_at).getTime();
    if (date >= todayStart) {
      today.push(p);
    } else if (date >= yesterdayStart) {
      yesterday.push(p);
    } else {
      older.push(p);
    }
  });

  const renderRow = (p: StudentPayment) => {
    const isPaid = p.status.toLowerCase() === "paid" || p.status.toLowerCase() === "completed";
    const invoiceNum = isPaid ? (p.invoice_number || `INV-${String(p.id).padStart(6, "0")}`) : "—";

    const planName = p.plan_name || "Assessment Access Plan";
    const amountText = formatCurrencyAmount(parseFloat(p.final_amount || "0"), p.currency || "INR");
    const validityDays = p.validity_days ? `${p.validity_days} Days` : "30 Days";

    return (
      <tr key={p.id}>
        <td>
          {isPaid ? (
            <span className="invoice-badge">{invoiceNum}</span>
          ) : (
            <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>—</span>
          )}
        </td>
        <td>
          <strong>{planName}</strong>
        </td>
        <td>{amountText}</td>
        <td>
          <span className={`status-chip ${p.status}`}>
            {strings.status[p.status as keyof typeof strings.status] || p.status}
          </span>
        </td>
        <td>
          <div>
            <div className="validity-cell-inline">
              <span className="validity-days-text">{validityDays}</span>
              {p.subscription && (
                <span className={`sub-status-chip ${p.subscription.status}`}>
                  {strings.subStatus[p.subscription.status as keyof typeof strings.subStatus] ||
                    p.subscription.status}
                </span>
              )}
            </div>
            {p.subscription && (
              <small className="date-range-subtext">
                {formatDate(p.subscription.starts_at)} – {formatDate(p.subscription.expires_at)}
              </small>
            )}
          </div>
        </td>

        <td>{formatDate(p.paid_at || p.created_at)}</td>
        <td>
          {isPaid ? (
            <button
              type="button"
              className="btn-view-invoice"
              onClick={() => setSelectedInvoice(p)}
            >
              <Icon name="eye" style={{ fontSize: "13px" }} />
              {strings.table.viewInvoice}
            </button>
          ) : (
            <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>—</span>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="purchase-history-container">
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />

      {/* Metrics Summary Row */}
      <div className="purchase-stats-grid">
        <div className="purchase-stat-card">
          <div className="purchase-stat-icon red">
            <Icon name="wallet" />
          </div>
          <div className="purchase-stat-info">
            <label>{strings.stats.totalBilled}</label>
            <h3>{formatCurrencyAmount(totalSpent, "INR")}</h3>
          </div>
        </div>

        <div className="purchase-stat-card">
          <div className="purchase-stat-icon blue">
            <Icon name="transactions" />
          </div>
          <div className="purchase-stat-info">
            <label>{strings.stats.totalPurchases}</label>
            <h3>{payments.length}</h3>
          </div>
        </div>

        <div className="purchase-stat-card">
          <div className="purchase-stat-icon green">
            <Icon name="plan" />
          </div>
          <div className="purchase-stat-info">
            <label>{strings.stats.activePlan}</label>
            <h3>{activeSub ? `${activeSub.plan_name} (${activeSub.validity_days || 30} Days)` : strings.stats.noActive}</h3>
          </div>
        </div>
      </div>

      {/* Modern Filter & Search Controls Bar */}
      <div className="purchase-filters-bar">
        <SearchInput
          className="purchase-search-input"
          value={search}
          onChange={setSearch}
          placeholder={strings.filters.searchPlaceholder}
        />

        <SearchableSelect
          options={statusOptions}
          value={statusFilter}
          onChange={(val) => setStatusFilter(String(val))}
          searchable={false}
          placeholder={strings.filters.allStatuses}
          className="purchase-filter-dropdown"
        />

        <SearchableSelect
          options={subStatusOptions}
          value={subStatusFilter}
          onChange={(val) => setSubStatusFilter(String(val))}
          searchable={false}
          placeholder={strings.filters.allSubStatuses}
          className="purchase-filter-dropdown"
        />

        {(search || statusFilter !== "all" || subStatusFilter !== "all") && (
          <button
            type="button"
            className="btn-clear-filters"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setSubStatusFilter("all");
            }}
          >
            <Icon name="cross" style={{ fontSize: "12px" }} />
            {strings.empty.clearFilters}
          </button>
        )}
      </div>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>{strings.loading}</p>
      ) : filteredPayments.length === 0 ? (
        <div className="empty-state" style={{ background: "#ffffff", padding: "2.5rem", borderRadius: "12px", border: "1px solid #e2e8f0", textAlign: "center" }}>
          <h2>{strings.empty.title}</h2>
          <p>{strings.empty.description}</p>
          <Link to="/student/courses" className="btn-primary" style={{ marginTop: "1rem", display: "inline-block" }}>
            {strings.empty.exploreBtn}
          </Link>
        </div>
      ) : (
        <div className="purchase-history-card">
          <table className="purchase-history-table">
            <thead>
              <tr>
                <th>{strings.table.invoice}</th>
                <th>{strings.table.plan}</th>
                <th>{strings.table.amount}</th>
                <th>{strings.table.status}</th>
                <th>{strings.table.validity}</th>
                <th>{strings.table.date}</th>
                <th>{strings.table.action}</th>
              </tr>
            </thead>
            <tbody>
              {today.length > 0 && (
                <>
                  <tr className="table-group-header">
                    <td colSpan={7}>Today</td>
                  </tr>
                  {today.map(renderRow)}
                </>
              )}
              {yesterday.length > 0 && (
                <>
                  <tr className="table-group-header">
                    <td colSpan={7}>Yesterday</td>
                  </tr>
                  {yesterday.map(renderRow)}
                </>
              )}
              {older.length > 0 && (
                <>
                  <tr className="table-group-header">
                    <td colSpan={7}>Older Transactions</td>
                  </tr>
                  {older.map(renderRow)}
                </>
              )}
            </tbody>

          </table>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="student-invoice-modal-backdrop" onClick={() => setSelectedInvoice(null)}>
          <div className="student-invoice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="student-invoice-header">
              <h3>{strings.invoiceModal.title}</h3>
              <button
                type="button"
                className="student-invoice-close-btn"
                onClick={() => setSelectedInvoice(null)}
                title="Close"
              >
                &times;
              </button>
            </div>

            <div className="student-invoice-body">
              <div className="invoice-brand-bar">
                <div className="invoice-brand-left">
                  <img src="/brand/vh-mark-96.png" alt="Visa House Logo" className="invoice-brand-logo" />
                  <div>
                    <div className="invoice-brand-title">{strings.invoiceModal.companyName}</div>
                    <div className="invoice-brand-tagline">{strings.invoiceModal.companyTagline}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className="invoice-badge" style={{ fontSize: "1rem", padding: "0.4rem 0.8rem" }}>
                    {selectedInvoice.invoice_number || `INV-${selectedInvoice.id}`}
                  </span>
                </div>
              </div>

              <div className="invoice-meta-grid">
                <div className="invoice-meta-block">
                  <label>{strings.invoiceModal.billedTo}</label>
                  <p>
                    {user?.first_name} {user?.last_name}
                  </p>
                  <small style={{ color: "#64748b" }}>{user?.email}</small>
                </div>
                <div className="invoice-meta-block">
                  <label>{strings.invoiceModal.paymentDate}</label>
                  <p>{formatDate(selectedInvoice.paid_at || selectedInvoice.created_at)}</p>
                  <span className={`status-chip ${selectedInvoice.status}`} style={{ marginTop: "0.25rem" }}>
                    {strings.status[selectedInvoice.status as keyof typeof strings.status] || selectedInvoice.status}
                  </span>
                </div>
                {selectedInvoice.gateway_reference && (
                  <div className="invoice-meta-block" style={{ gridColumn: "1 / -1", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>GATEWAY TRANSACTION & ORDER ID</label>
                    <p style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 700, color: "#0f172a", margin: "2px 0 0" }}>
                      {selectedInvoice.gateway_reference}
                    </p>
                  </div>
                )}
              </div>


              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>{strings.invoiceModal.itemDescription}</th>
                    <th>{strings.invoiceModal.duration}</th>
                    <th style={{ textAlign: "right" }}>{strings.invoiceModal.amount}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <strong>{selectedInvoice.plan_name || "Assessment Access Plan"}</strong>
                    </td>
                    <td>{selectedInvoice.validity_days ? `${selectedInvoice.validity_days} Days` : "30 Days"}</td>
                    <td style={{ textAlign: "right" }}>
                      {formatCurrencyAmount(
                        parseFloat(selectedInvoice.amount || "0"),
                        selectedInvoice.currency || "INR"
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {selectedInvoice.subscription && (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    padding: "0.875rem 1rem",
                    borderRadius: "8px",
                    marginBottom: "1.25rem",
                  }}
                >
                  <strong style={{ color: "#166534", display: "block", fontSize: "0.8125rem" }}>
                    {strings.invoiceModal.subscriptionValidity}
                  </strong>
                  <span style={{ fontSize: "0.875rem", color: "#15803d" }}>
                    {strings.invoiceModal.from}: <strong>{formatDate(selectedInvoice.subscription.starts_at)}</strong>
                    &nbsp;|&nbsp;
                    {strings.invoiceModal.to}: <strong>{formatDate(selectedInvoice.subscription.expires_at)}</strong>
                  </span>
                </div>
              )}

              <div className="invoice-summary-box">
                <div className="invoice-summary-row">
                  <span>{strings.invoiceModal.subtotal}</span>
                  <span>
                    {formatCurrencyAmount(
                      parseFloat(selectedInvoice.amount || "0"),
                      selectedInvoice.currency || "INR"
                    )}
                  </span>
                </div>
                {parseFloat(selectedInvoice.discount_amount || "0") > 0 && (
                  <div className="invoice-summary-row" style={{ color: "#16a34a" }}>
                    <span>{strings.invoiceModal.discount}</span>
                    <span>
                      -
                      {formatCurrencyAmount(
                        parseFloat(selectedInvoice.discount_amount || "0"),
                        selectedInvoice.currency || "INR"
                      )}
                    </span>
                  </div>
                )}
                <div className="invoice-summary-row total">
                  <span>{strings.invoiceModal.totalPaid}</span>
                  <span>
                    {formatCurrencyAmount(
                      parseFloat(selectedInvoice.final_amount || "0"),
                      selectedInvoice.currency || "INR"
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="student-invoice-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleDownloadPdf(selectedInvoice)}
              >
                <Icon name="download" style={{ fontSize: "16px" }} />
                {strings.invoiceModal.downloadPdf}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => window.print()}
              >
                <Icon name="printer" style={{ fontSize: "16px" }} />
                {strings.invoiceModal.printInvoice}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
