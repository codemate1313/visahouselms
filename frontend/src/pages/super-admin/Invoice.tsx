import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { apiClient } from "@/api/client";
import { useToastStore } from "@/store/toastStore";
import { formatCurrencyAmount } from "@/utils/currency";
import { invoiceStrings as strings } from "./Invoice.strings";
import "./Invoice.css";
import { commonActions } from "@/content/common.strings";
import { Icon } from "@/components/icons";
import { Button, SearchableSelect } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { formatDate, formatDateTime } from "@/utils/date";

interface PaymentDetail {
  id: number;
  source: string;
  institute_name: string | null;
  customer_email: string | null;
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

function formatPdfCurrency(amount: string | number | null | undefined, currency?: string | null): string {
  const numeric = Number(amount ?? 0);
  const formattedNumber = Number.isFinite(numeric)
    ? numeric.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
  const code = (currency || "INR").trim().toUpperCase();
  const symbol = code === "INR" ? "Rs." : code === "USD" ? "$" : code;
  return `${symbol} ${formattedNumber}`;
}

async function loadLogoDataUrl(): Promise<string | null> {
  const sources = [
    "/brand/visa-house-round-logo.png",
    "/brand/vh-mark.png",
    "/brand/vh-badge.png",
    "/brand/vh-mark-dark-96.png",
  ];
  for (const src of sources) {
    try {
      const res = await fetch(src);
      if (!res.ok) continue;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject();
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // try next fallback image
    }
  }
  return null;
}

export function Invoice() {
  const { id } = useParams();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const showToast = useToastStore((s) => s.showSuccess);
  const showError = useToastStore((s) => s.showError);

  // Modals state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payMethod, setPayMethod] = useState<string>("Card");
  const [payRef, setPayRef] = useState<string>("");
  const [emailRecipient, setEmailRecipient] = useState<string>("");
  const [emailNote, setEmailNote] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    apiClient
      .get(`/super-admin/payments/${id}`)
      .then(({ data }) => {
        setPayment(data);
        setPayAmount(String(data.due_amount || "0").replace(/,/g, "."));
        setEmailRecipient(data.customer_email || "");
      })
      .catch(() => setError(strings.errors.load));
  }, [id]);

  const handleOpenEmailModal = () => {
    if (payment?.customer_email) {
      setEmailRecipient(payment.customer_email);
    }
    setShowEmailModal(true);
  };

  const generateInvoicePdfDoc = async (paymentData: PaymentDetail): Promise<{ doc: jsPDF; invNum: string }> => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const invNum = paymentData.invoice_number || `INV-${String(paymentData.id).padStart(6, "0")}`;
    const currencyCode = paymentData.currency || "INR";
    const logoData = await loadLogoDataUrl();

    // 1. Top Subtle Brand Accent
    doc.setFillColor(163, 28, 40);
    doc.rect(0, 0, 210, 3, "F");

    // 2. Company Brand & Document Header (y: 14 to 34)
    if (logoData) {
      try {
        doc.addImage(logoData, "PNG", 15, 12, 16, 16);
      } catch {
        doc.setFillColor(163, 28, 40);
        doc.roundedRect(15, 12, 16, 16, 2, 2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("VH", 23, 22, { align: "center" });
      }
    } else {
      doc.setFillColor(163, 28, 40);
      doc.roundedRect(15, 12, 16, 16, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("VH", 23, 22, { align: "center" });
    }

    doc.setTextColor(15, 23, 42); // Slate 900
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("VISA HOUSE", 35, 19);

    doc.setTextColor(100, 116, 139); // Slate 500
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("Language CERT Assessment Platform", 35, 24);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("support@visahouse.com  •  www.visahouse.com", 35, 28.5);

    // Right: TAX INVOICE & Invoice Number
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("TAX INVOICE", 195, 18, { align: "right" });

    doc.setTextColor(163, 28, 40);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`INVOICE #: ${invNum}`, 195, 23.5, { align: "right" });

    // Status Badge Pill
    const isPaidStatus = paymentData.status === "paid" || Number(paymentData.due_amount) === 0;
    const isPartialStatus = paymentData.status === "partial" || (Number(paymentData.amount_paid) > 0 && Number(paymentData.due_amount) > 0);
    const statusLabel = isPaidStatus ? "PAID" : isPartialStatus ? "PARTIAL" : "UNPAID DUE";

    if (isPaidStatus) {
      doc.setFillColor(220, 252, 231); // Light emerald
      doc.setDrawColor(134, 239, 172);
      doc.roundedRect(173, 26, 22, 5.5, 1.5, 1.5, "FD");
      doc.setTextColor(22, 101, 52); // Dark green
    } else if (isPartialStatus) {
      doc.setFillColor(254, 243, 199); // Light amber
      doc.setDrawColor(252, 211, 77);
      doc.roundedRect(171, 26, 24, 5.5, 1.5, 1.5, "FD");
      doc.setTextColor(146, 64, 14);
    } else {
      doc.setFillColor(254, 226, 226); // Light red
      doc.setDrawColor(252, 165, 165);
      doc.roundedRect(168, 26, 27, 5.5, 1.5, 1.5, "FD");
      doc.setTextColor(153, 27, 27);
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(statusLabel, 195 - (isPaidStatus ? 11 : isPartialStatus ? 12 : 13.5), 30, { align: "center" });

    // Header bottom border
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.line(15, 34, 195, 34);

    // 3. Metadata & Invoice Details (y: 37 to 69)
    const cardY = 37;
    const cardHeight = 31;

    // Box 1: Billed To (x: 15, width: 88, height: 31)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, cardY, 88, cardHeight, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, cardY, 88, cardHeight, 2, 2, "S");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("BILLED TO", 20, cardY + 6);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    const billedName = paymentData.institute_name || strings.directCustomer;
    doc.text(billedName, 20, cardY + 11.5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Plan: ${paymentData.plan_name || "Assessment Access Plan"} (${paymentData.source.toUpperCase()})`, 20, cardY + 16.5);
    if (paymentData.customer_email) {
      doc.text(`Email: ${paymentData.customer_email}`, 20, cardY + 21);
    } else {
      doc.text(`Channel: Direct Student Portal`, 20, cardY + 21);
    }
    doc.text(`Issue Date: ${formatDate(paymentData.created_at)}`, 20, cardY + 25.5);

    // Box 2: Payment Information (x: 107, width: 88, height: 31)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(107, cardY, 88, cardHeight, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(107, cardY, 88, cardHeight, 2, 2, "S");

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("PAYMENT DETAILS", 112, cardY + 6);

    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    const methodDisplay = (paymentData.payment_method_name || paymentData.gateway || "Online Payment").toUpperCase();
    doc.text(methodDisplay, 112, cardY + 11.5);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(`Gateway: ${(paymentData.gateway || "Razorpay").toUpperCase()}`, 112, cardY + 16.5);

    if (paymentData.gateway_reference) {
      if (paymentData.gateway_reference.includes("|")) {
        const parts = paymentData.gateway_reference.split("|").map((s) => s.trim());
        const orderP = parts[0] ? parts[0].replace(/^Order:\s*/i, "Order: ") : "";
        const payP = parts[1] ? parts[1].replace(/^Payment:\s*/i, "Pay ID: ") : "";
        doc.text(orderP, 112, cardY + 21, { maxWidth: 78 });
        if (payP) {
          doc.text(payP, 112, cardY + 25.5, { maxWidth: 78 });
        } else if (paymentData.paid_at) {
          doc.text(`Settled On: ${formatDate(paymentData.paid_at)}`, 112, cardY + 25.5);
        }
      } else {
        doc.text(`Ref: ${paymentData.gateway_reference}`, 112, cardY + 21, { maxWidth: 78 });
        if (paymentData.paid_at) {
          doc.text(`Settled On: ${formatDate(paymentData.paid_at)}`, 112, cardY + 25.5);
        }
      }
    } else if (paymentData.paid_at) {
      doc.text(`Settled On: ${formatDate(paymentData.paid_at)}`, 112, cardY + 21);
      doc.text(`Status: Completed & Verified`, 112, cardY + 25.5);
    } else {
      doc.text(`Status: Pending Settlement`, 112, cardY + 21);
    }

    // 4. Line Items Table (y starts at 72)
    const tableHead = [["#", "ITEM DESCRIPTION", "PLAN / CATEGORY", "QTY", "RATE", "NET AMOUNT"]];

    const tableBody = [
      [
        "1",
        `${paymentData.plan_name || "Assessment Access Plan"}\nOnline Test Engine & AI Rubric Scoring Access`,
        paymentData.source.toUpperCase(),
        "1",
        formatPdfCurrency(paymentData.amount, currencyCode),
        formatPdfCurrency(paymentData.amount, currencyCode),
      ],
    ];

    if (Number(paymentData.discount_amount) > 0) {
      tableBody.push([
        "2",
        `Promotional Discount ${paymentData.coupon_code ? `(Coupon: ${paymentData.coupon_code})` : ""}`,
        "PROMO",
        "1",
        `-${formatPdfCurrency(paymentData.discount_amount, currencyCode)}`,
        `-${formatPdfCurrency(paymentData.discount_amount, currencyCode)}`,
      ]);
    }

    autoTable(doc, {
      startY: 72,
      margin: { left: 15, right: 15 },
      head: tableHead,
      body: tableBody,
      theme: "plain",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 3.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 80 },
        2: { cellWidth: 25, halign: "center" },
        3: { cellWidth: 15, halign: "center" },
        4: { cellWidth: 25, halign: "right" },
        5: { cellWidth: 25, halign: "right", fontStyle: "bold" },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    const tableFinalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    // 5. Summary Section & Clear Terms & Conditions (Below table)
    const bottomBoxY = tableFinalY + 6;
    const bottomBoxHeight = 44;
    const termsBoxX = 15;
    const termsBoxW = 102;
    const summaryBoxX = 122;
    const summaryBoxW = 73;

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(termsBoxX, bottomBoxY, termsBoxW, bottomBoxHeight, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(termsBoxX, bottomBoxY, termsBoxW, bottomBoxHeight, 2, 2, "S");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("TERMS & CONDITIONS", termsBoxX + 5, bottomBoxY + 7.5);

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);

    const bulletPoints = [
      "• Access License: Grants access to Language CERT module test exams.",
      "• Non-Transferable: Digital subscriptions and vouchers are strictly non-transferable.",
      "• Billing Support: Reach out to support@visahouse.com for any billing inquiries.",
      "• Authentic Document: System generated electronic tax invoice. No signature needed.",
    ];

    let currentBulletY = bottomBoxY + 14;
    bulletPoints.forEach((point) => {
      const lines = doc.splitTextToSize(point, termsBoxW - 10);
      doc.text(lines, termsBoxX + 5, currentBulletY);
      currentBulletY += lines.length * 4.2 + 1.2;
    });

    // Right Card: Totals Summary
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(summaryBoxX, bottomBoxY, summaryBoxW, bottomBoxHeight, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(summaryBoxX, bottomBoxY, summaryBoxW, bottomBoxHeight, 2, 2, "S");

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Total Invoice Amount:", summaryBoxX + 4, bottomBoxY + 9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatPdfCurrency(paymentData.final_amount, currencyCode), summaryBoxX + summaryBoxW - 4, bottomBoxY + 9, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Total Settled (Paid):", summaryBoxX + 4, bottomBoxY + 18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52); // Green
    doc.text(formatPdfCurrency(paymentData.amount_paid, currencyCode), summaryBoxX + summaryBoxW - 4, bottomBoxY + 18, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.line(summaryBoxX + 4, bottomBoxY + 24, summaryBoxX + summaryBoxW - 4, bottomBoxY + 24);

    const dueAmt = Number(paymentData.due_amount) || 0;
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "bold");
    if (dueAmt > 0) {
      doc.setTextColor(220, 38, 38); // Red
      doc.text("Balance Outstanding:", summaryBoxX + 4, bottomBoxY + 34);
      doc.text(formatPdfCurrency(paymentData.due_amount, currencyCode), summaryBoxX + summaryBoxW - 4, bottomBoxY + 34, { align: "right" });
    } else {
      doc.setTextColor(15, 23, 42);
      doc.text("Balance Outstanding:", summaryBoxX + 4, bottomBoxY + 34);
      doc.setTextColor(22, 101, 52);
      doc.text(formatPdfCurrency("0.00", currencyCode), summaryBoxX + summaryBoxW - 4, bottomBoxY + 34, { align: "right" });
    }

    // 6. Security Seal & Corporate Footer
    const footerY = 276;
    doc.setDrawColor(226, 232, 240);
    doc.line(15, footerY, 195, footerY);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("VISA HOUSE • LANGUAGE CERT ASSESSMENT PLATFORM", 105, footerY + 6, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("support@visahouse.com  •  www.visahouse.com  •  Computer Generated Tax Invoice", 105, footerY + 11, { align: "center" });

    return { doc, invNum };
  };

  const handleDownloadPDF = async () => {
    if (!payment) return;
    const { doc, invNum } = await generateInvoicePdfDoc(payment);
    doc.save(`Invoice_${invNum}.pdf`);
    showToast(strings.toasts.pdfGenerated);
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    const addAmount = Number(String(payAmount).replace(/,/g, "."));
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

  const handleSendEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment || !emailRecipient.trim()) return;

    setIsSendingEmail(true);
    try {
      await apiClient.post(`/super-admin/payments/${payment.id}/send-email`, {
        recipient_email: emailRecipient.trim(),
        custom_message: emailNote.trim() || undefined,
      });
      setShowEmailModal(false);
      showToast(strings.toasts.emailSent);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to send email receipt";
      showError(typeof msg === "string" ? msg : "Failed to send email receipt");
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (error) {
    return (
      <div className="invoice-page-container">
        <div className="error-text" style={{ padding: "40px", textAlign: "center" }}>{error}</div>
      </div>
    );
  }

  if (!payment) {
    return <RouteLoadingState />;
  }

  const finalAmtNum = Number(payment.final_amount) || 1;
  const paidAmtNum = Number(payment.amount_paid) || 0;
  const dueAmtNum = Number(payment.due_amount) || 0;
  const paidRatio = (paidAmtNum / finalAmtNum) * 100;
  const paidPercentage = dueAmtNum > 0 ? Math.min(99, Math.floor(paidRatio)) : 100;

  const isPaid = payment.status === "paid" || dueAmtNum === 0;
  const isPartial = payment.status === "partial" || (paidAmtNum > 0 && dueAmtNum > 0);

  return (
    <div className="invoice-page-container">
      {/* Top Header & Actions */}
      <div className="invoice-top-bar no-print">
        <div className="invoice-title-area">
          <h1>{strings.titlePrefix} {payment.invoice_number || `INV-${payment.id}`}</h1>
          <p>{strings.companySubtitle}</p>
        </div>

        <div className="invoice-actions-group">
          <Button variant="secondary" className="invoice-btn invoice-btn-secondary" onClick={handleOpenEmailModal} title="Email Receipt">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            {strings.emailReceipt}
          </Button>

          <Button variant="primary" className="invoice-btn invoice-btn-primary" onClick={handleDownloadPDF} title="Download PDF Document">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {strings.downloadPdf}
          </Button>

          {dueAmtNum > 0 && (
            <Button variant="primary" className="invoice-btn invoice-btn-success" onClick={() => setShowPaymentModal(true)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              {strings.recordPayment}
            </Button>
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
                {strings.issueDate}: {formatDate(payment.created_at)}
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
                <p className="invoice-info-card-sub">{strings.fullyPaidOn}: {formatDateTime(payment.paid_at)}</p>
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
                <span className="invoice-timeline-date">{formatDateTime(payment.created_at)}</span>
              </div>
              {paidAmtNum > 0 && (
                <div className="invoice-timeline-item item-paid">
                  <span className="invoice-timeline-text">
                    Payment of {formatCurrencyAmount(payment.amount_paid, payment.currency)} received via {payment.payment_method_name || payment.gateway || "Card"}
                  </span>
                  <span className="invoice-timeline-date">{formatDateTime(payment.paid_at ?? payment.created_at)}</span>
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
              <IconButton className="invoice-modal-close" label={commonActions.close} onClick={() => setShowPaymentModal(false)} icon={<Icon name="cross" />} />
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: 0 }}>
              {strings.modals.recordPaymentDesc}
            </p>

            <form onSubmit={handleRecordPaymentSubmit}>
              <div className="invoice-field">
                <label>{strings.modals.amountToPay}</label>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={payAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/,/g, ".");
                    if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setPayAmount(val);
                    }
                  }}
                  placeholder="0.00"
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
                <Button type="button" variant="secondary" className="invoice-btn invoice-btn-secondary" onClick={() => setShowPaymentModal(false)}>
                  {strings.modals.cancel}
                </Button>
                <Button type="submit" variant="primary" className="invoice-btn invoice-btn-success">
                  {strings.modals.confirmRecord}
                </Button>
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
              <IconButton className="invoice-modal-close" label={commonActions.close} onClick={() => setShowEmailModal(false)} icon={<Icon name="cross" />} />
            </div>

            <form onSubmit={handleSendEmailSubmit}>
              <div className="invoice-field">
                <label>{strings.modals.recipientEmail}</label>
                <input
                  type="email"
                  placeholder="billing@customer.com"
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
                <Button type="button" variant="secondary" className="invoice-btn invoice-btn-secondary" onClick={() => setShowEmailModal(false)}>
                  {strings.modals.cancel}
                </Button>
                <Button type="submit" variant="primary" className="invoice-btn invoice-btn-primary" disabled={isSendingEmail} loading={isSendingEmail}>
                  {isSendingEmail ? "Sending..." : strings.modals.sendEmail}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
