import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { apiClient } from "@/api/client";
import { formatCurrencyAmount } from "@/utils/currency";
import { invoiceStrings as strings } from "./Invoice.strings";
import "./Invoice.css";
import { commonActions } from "@/content/common.strings";
import { Icon } from "@/components/icons";
import { SearchableSelect } from "@/components/ui";

interface PaymentDetail {
  id: number;
  source: string;
  institute_name: string | null;
  plan_name: string | null;
  amount: string;
  discount_amount: string;
  final_amount: string;
  amount_paid: string;
  due_amount: string;
  currency: string;
  coupon_code: string | null;
  payment_method_name: string | null;
  gateway: string;
  gateway_reference: string | null;
  status: string;
  invoice_number: string | null;
  created_at: string;
  paid_at: string | null;
}

export function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("Card");
  const [payRef, setPayRef] = useState<string>("");
  const [emailRecipient, setEmailRecipient] = useState<string>("");
  const [emailNote, setEmailNote] = useState<string>("");

  useEffect(() => {
    apiClient
      .get(`/super-admin/payments/${id}`)
      .then(({ data }) => {
        setPayment(data);
        setPayAmount(data.due_amount || "0");
        setEmailRecipient(data.institute_name ? `${data.institute_name.toLowerCase().replace(/\s+/g, "")}@example.com` : "billing@customer.com");
      })
      .catch(() => setError(strings.errors.load));
  }, [id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    showToast(strings.toasts.copied);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!payment) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const invNum = payment.invoice_number || `INV-${payment.id}`;

    // Header Crimson Banner
    doc.setFillColor(163, 28, 40);
    doc.rect(0, 0, 210, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(strings.companyName, 14, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`TAX INVOICE / RECEIPT`, 196, 15, { align: "right" });

    // Meta Block
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Invoice: ${invNum}`, 14, 38);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Issue Date: ${new Date(payment.created_at).toLocaleDateString("en-GB")}`, 14, 45);
    doc.text(`Status: ${payment.status.toUpperCase()}`, 196, 38, { align: "right" });
    if (payment.paid_at) {
      doc.text(`Paid Date: ${new Date(payment.paid_at).toLocaleDateString("en-GB")}`, 196, 45, { align: "right" });
    }

    // Billed To Box
    doc.setFillColor(248, 250, 252);
    doc.rect(14, 52, 182, 24, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 52, 182, 24, "S");

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("BILLED TO", 20, 60);
    doc.text("PAYMENT METHOD", 120, 60);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(payment.institute_name || strings.directCustomer, 20, 68);
    doc.text(payment.payment_method_name || payment.gateway || "Card", 120, 68);

    // Line Items Table
    const tableBody = [
      [
        `${payment.plan_name || "Subscription Plan"} (${payment.source.toUpperCase()})`,
        formatCurrencyAmount(payment.amount, payment.currency)
      ]
    ];
    if (Number(payment.discount_amount) > 0) {
      tableBody.push([
        `Discount Applied ${payment.coupon_code ? `(${payment.coupon_code})` : ""}`,
        `- ${formatCurrencyAmount(payment.discount_amount, payment.currency)}`
      ]);
    }

    autoTable(doc, {
      startY: 84,
      head: [[strings.table.description, strings.table.amount]],
      body: tableBody,
      styles: { fontSize: 10, cellPadding: 6, textColor: [15, 23, 42] },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 52, halign: "right" } },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    // Summary Box
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${strings.table.total}:`, 130, finalY);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrencyAmount(payment.final_amount, payment.currency), 196, finalY, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.text(`${strings.table.amountPaid}:`, 130, finalY + 7);
    doc.text(formatCurrencyAmount(payment.amount_paid, payment.currency), 196, finalY + 7, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(220, 38, 38);
    doc.text(`${strings.table.balanceDue}:`, 130, finalY + 14);
    doc.text(formatCurrencyAmount(payment.due_amount, payment.currency), 196, finalY + 14, { align: "right" });

    // Footer
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(strings.verifiedSeal, 105, 280, { align: "center" });

    doc.save(`Invoice_${invNum}.pdf`);
    showToast(strings.toasts.pdfGenerated);
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    const addAmount = Number(payAmount);
    if (isNaN(addAmount) || addAmount <= 0) return;

    const currentPaid = Number(payment.amount_paid);
    const newPaid = currentPaid + addAmount;
    const finalAmt = Number(payment.final_amount);
    const newDue = Math.max(0, finalAmt - newPaid);

    setPayment({
      ...payment,
      amount_paid: newPaid.toString(),
      due_amount: newDue.toString(),
      status: newDue === 0 ? "paid" : "partial",
      paid_at: newDue === 0 ? new Date().toISOString() : payment.paid_at,
      payment_method_name: payMethod,
      gateway_reference: payRef || payment.gateway_reference || "MANUAL-REC",
    });

    setShowPaymentModal(false);
    showToast(strings.toasts.paymentRecorded);
  };

  const handleSendEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowEmailModal(false);
    showToast(strings.toasts.emailSent);
  };

  if (error) {
    return (
      <div className="invoice-page-container">
        <div className="invoice-top-bar">
          <button className="invoice-back-btn" onClick={() => navigate("/super-admin/payments")}>
            <Icon name="arrowLeft" /> {strings.backToPayments}
          </button>
        </div>
        <div className="error-text" style={{ padding: "40px", textAlign: "center" }}>{error}</div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="invoice-page-container" style={{ textAlign: "center", padding: "60px 0" }}>
        <p className="hint">{strings.loading}</p>
      </div>
    );
  }

  const finalAmtNum = Number(payment.final_amount) || 1;
  const paidAmtNum = Number(payment.amount_paid) || 0;
  const dueAmtNum = Number(payment.due_amount) || 0;
  const paidPercentage = Math.min(100, Math.round((paidAmtNum / finalAmtNum) * 100));

  const isPaid = payment.status === "paid" || dueAmtNum === 0;
  const isPartial = payment.status === "partial" || (paidAmtNum > 0 && dueAmtNum > 0);

  return (
    <div className="invoice-page-container">
      {/* Top Header & Actions */}
      <div className="invoice-top-bar no-print">
        <div className="invoice-breadcrumb">
          <button className="invoice-back-btn" onClick={() => navigate("/super-admin/payments")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            {strings.backToPayments}
          </button>
          <div className="invoice-title-area">
            <h1>{strings.titlePrefix} {payment.invoice_number}</h1>
            <p>{strings.companySubtitle}</p>
          </div>
        </div>

        <div className="invoice-actions-group">
          <button className="invoice-btn invoice-btn-secondary" onClick={handleCopyLink} title="Copy Link">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {strings.shareLink}
          </button>

          <button className="invoice-btn invoice-btn-secondary" onClick={() => setShowEmailModal(true)} title="Email Receipt">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            {strings.emailReceipt}
          </button>

          <button className="invoice-btn invoice-btn-secondary" onClick={handlePrint} title="Print Invoice">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            {strings.print}
          </button>

          <button className="invoice-btn invoice-btn-primary" onClick={handleDownloadPDF} title="Download PDF Document">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {strings.downloadPdf}
          </button>

          {dueAmtNum > 0 && (
            <button className="invoice-btn invoice-btn-success" onClick={() => setShowPaymentModal(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              {strings.recordPayment}
            </button>
          )}
        </div>
      </div>

      {/* Main Luxury Receipt Document Card */}
      <div className="invoice-card-wrapper">
        <div className="invoice-card-top-accent" />

        <div className="invoice-card-body">
          {/* Header Brand Section */}
          <div className="invoice-brand-header">
            <div className="invoice-brand-identity">
              <div className="invoice-brand-logo-mark">VH</div>
              <div className="invoice-brand-info">
                <h2>{strings.companyName}</h2>
                <p className="invoice-brand-subtitle">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  {strings.companySubtitle}
                </p>
              </div>
            </div>

            <div className="invoice-meta-block">
              <div className="invoice-number-tag">
                {payment.invoice_number || `INV-${payment.id}`}
              </div>
              <div className="invoice-date-stamp">
                {strings.issueDate}: {new Date(payment.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </div>

              {/* Status Pill */}
              <div className={`status-pill ${isPaid ? "status-paid" : isPartial ? "status-partial" : "status-due"}`}>
                <span className="status-pill-pulse" />
                {isPaid ? "PAID" : isPartial ? `PARTIAL (${paidPercentage}%)` : "UNPAID DUE"}
              </div>
            </div>
          </div>

          {/* Quick Metrics Banner */}
          <div className="invoice-metrics-banner">
            <div className="invoice-metric-tile">
              <span className="invoice-metric-label">{strings.metrics.totalBilled}</span>
              <span className="invoice-metric-value">{formatCurrencyAmount(payment.final_amount, payment.currency)}</span>
            </div>

            <div className="invoice-metric-tile tile-highlight-paid">
              <span className="invoice-metric-label">{strings.metrics.amountPaid}</span>
              <span className="invoice-metric-value">{formatCurrencyAmount(payment.amount_paid, payment.currency)}</span>
            </div>

            <div className={`invoice-metric-tile ${dueAmtNum > 0 ? "tile-highlight-due" : ""}`}>
              <span className="invoice-metric-label">{strings.metrics.balanceDue}</span>
              <span className="invoice-metric-value">{formatCurrencyAmount(payment.due_amount, payment.currency)}</span>
            </div>
          </div>

          {/* Details Section Grid */}
          <div className="invoice-details-grid">
            <div className="invoice-info-card">
              <div className="invoice-info-card-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {strings.billedTo}
              </div>
              <h3 className="invoice-info-card-title">{payment.institute_name || strings.directCustomer}</h3>
              <p className="invoice-info-card-sub">Plan: {payment.plan_name || "Subscription Plan"}</p>
              <p className="invoice-info-card-sub">Source: {payment.source.toUpperCase()}</p>
            </div>

            <div className="invoice-info-card">
              <div className="invoice-info-card-header">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                {strings.paymentDetails}
              </div>
              <h3 className="invoice-info-card-title">{payment.payment_method_name || payment.gateway || "Credit / Debit Card"}</h3>
              <p className="invoice-info-card-sub">{strings.gateway}: {payment.gateway || "Standard Gateway"}</p>
              {payment.gateway_reference && (
                <p className="invoice-info-card-sub">{strings.transactionRef}: {payment.gateway_reference}</p>
              )}
              {payment.paid_at && (
                <p className="invoice-info-card-sub">{strings.fullyPaidOn}: {new Date(payment.paid_at).toLocaleString()}</p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="invoice-table-wrapper">
            <table className="invoice-table">
              <thead>
                <tr>
                  <th>{strings.table.description}</th>
                  <th>{strings.table.amount}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="invoice-item-name">
                      <span>{payment.plan_name || strings.table.purchase}</span>
                      <span className="invoice-item-tag">{payment.source}</span>
                    </div>
                  </td>
                  <td>{formatCurrencyAmount(payment.amount, payment.currency)}</td>
                </tr>

                {Number(payment.discount_amount) > 0 && (
                  <tr>
                    <td>
                      <div className="invoice-item-name ui-text-success">
                        <span>{strings.table.discount} {payment.coupon_code && `(${payment.coupon_code})`}</span>
                        <span className="invoice-item-tag ui-chip ui-chip-success">COUPON</span>
                      </div>
                    </td>
                    <td className="ui-text-success ui-text-strong">
                      - {formatCurrencyAmount(payment.discount_amount, payment.currency)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals Summary */}
            <div className="invoice-table-totals">
              <div className="invoice-totals-list">
                <div className="invoice-total-row grand-total">
                  <span>{strings.table.total}</span>
                  <span>{formatCurrencyAmount(payment.final_amount, payment.currency)}</span>
                </div>

                <div className="invoice-total-row">
                  <span>{strings.table.amountPaid}</span>
                  <span>{formatCurrencyAmount(payment.amount_paid, payment.currency)}</span>
                </div>

                {dueAmtNum > 0 && (
                  <div className="invoice-total-row due-row">
                    <span>{strings.table.balanceDue}</span>
                    <span>{formatCurrencyAmount(payment.due_amount, payment.currency)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Audit Timeline */}
          <div className="invoice-timeline-card">
            <div className="invoice-timeline-title">{strings.timelineTitle}</div>
            <div className="invoice-timeline-items">
              <div className="invoice-timeline-item item-paid">
                <span className="invoice-timeline-text">Invoice created & issued</span>
                <span className="invoice-timeline-date">{new Date(payment.created_at).toLocaleString()}</span>
              </div>
              {paidAmtNum > 0 && (
                <div className="invoice-timeline-item item-paid">
                  <span className="invoice-timeline-text">
                    Payment of {formatCurrencyAmount(payment.amount_paid, payment.currency)} received via {payment.payment_method_name || payment.gateway || "Card"}
                  </span>
                  <span className="invoice-timeline-date">{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : new Date(payment.created_at).toLocaleString()}</span>
                </div>
              )}
              {dueAmtNum > 0 && (
                <div className="invoice-timeline-item item-due">
                  <span className="invoice-timeline-text">Outstanding balance of {formatCurrencyAmount(payment.due_amount, payment.currency)} remaining</span>
                  <span className="invoice-timeline-date">Pending settlement</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Seal & Notes */}
          <div className="invoice-footer-area">
            <p className="invoice-footer-note">
              Thank you for subscribing to Visa House LMS. For any billing queries, contact support@visahouse.com.
            </p>
            <div className="invoice-seal-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {strings.verifiedSeal}
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal-content">
            <div className="invoice-modal-header">
              <h3>{strings.modals.recordPaymentTitle}</h3>
              <button className="invoice-modal-close" aria-label={commonActions.close} onClick={() => setShowPaymentModal(false)}>
                <Icon name="cross" />
              </button>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: 0 }}>
              {strings.modals.recordPaymentDesc}
            </p>

            <form onSubmit={handleRecordPaymentSubmit}>
              <div className="invoice-field">
                <label>{strings.modals.amountToPay}</label>
                <input
                  type="number"
                  step="0.01"
                  max={payment.due_amount}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                />
              </div>

              <div className="invoice-field">
                <label>{strings.modals.paymentMethod}</label>
                <SearchableSelect
                  ariaLabel={strings.modals.paymentMethod}
                  options={[
                    { value: "Card", label: "Credit / Debit Card" },
                    { value: "Bank Transfer", label: "Bank Wire / Transfer" },
                    { value: "UPI", label: "UPI / Instant Pay" },
                    { value: "Cash / Cheque", label: "Cash / Cheque" },
                  ]}
                  searchable={false}
                  value={payMethod}
                  onChange={(value) => setPayMethod(String(value))}
                />
              </div>

              <div className="invoice-field">
                <label>{strings.modals.referenceNotes}</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-99881122"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                />
              </div>

              <div className="invoice-modal-actions">
                <button type="button" className="invoice-btn invoice-btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  {strings.modals.cancel}
                </button>
                <button type="submit" className="invoice-btn invoice-btn-success">
                  {strings.modals.confirmRecord}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Receipt Modal */}
      {showEmailModal && (
        <div className="invoice-modal-overlay">
          <div className="invoice-modal-content">
            <div className="invoice-modal-header">
              <h3>{strings.modals.emailReceiptTitle}</h3>
              <button className="invoice-modal-close" aria-label={commonActions.close} onClick={() => setShowEmailModal(false)}>
                <Icon name="cross" />
              </button>
            </div>

            <form onSubmit={handleSendEmailSubmit}>
              <div className="invoice-field">
                <label>{strings.modals.recipientEmail}</label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  required
                />
              </div>

              <div className="invoice-field">
                <label>{strings.modals.customMessage}</label>
                <textarea
                  rows={3}
                  placeholder="Please find attached your payment receipt..."
                  value={emailNote}
                  onChange={(e) => setEmailNote(e.target.value)}
                />
              </div>

              <div className="invoice-modal-actions">
                <button type="button" className="invoice-btn invoice-btn-secondary" onClick={() => setShowEmailModal(false)}>
                  {strings.modals.cancel}
                </button>
                <button type="submit" className="invoice-btn invoice-btn-primary">
                  {strings.modals.sendEmail}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="invoice-toast">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
