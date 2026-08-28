import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { Badge, type BadgeTone } from "@/components/ui";
import { formatCurrencyAmount } from "@/utils/currency";
import { formatDate } from "@/utils/date";

export interface VoucherPurchase {
  id: number;
  purchase_number: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone?: string;
  offering_title: string;
  voucher_type_name: string;
  voucher_code: string;
  raw_code: string;
  amount: string;
  gst_amount: string;
  final_amount: string;
  gateway: string;
  gateway_transaction_id?: string;
  status: string;
  created_at: string;
  valid_until?: string;
}

interface PurchaseDetailsModalProps {
  purchase: VoucherPurchase;
  onClose: () => void;
  onViewInvoice?: (purchase: VoucherPurchase) => void;
}

function purchaseStatusTone(status: string): BadgeTone {
  if (status === "completed") return "success";
  if (status === "pending") return "warning";
  if (status === "refunded") return "info";
  return "danger";
}

function purchaseStatusLabel(status: string): string {
  if (status === "completed") return "Paid";
  if (status === "pending") return "Awaiting Payment";
  if (status === "failed") return "Failed";
  if (status === "refunded") return "Refunded";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function PurchaseDetailsModal({ purchase, onClose, onViewInvoice }: PurchaseDetailsModalProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedPurchaseNo, setCopiedPurchaseNo] = useState(false);

  const handleCopy = (text: string, type: "code" | "email" | "phone" | "purchaseno") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else if (type === "email") {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else if (type === "phone") {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else if (type === "purchaseno") {
      setCopiedPurchaseNo(true);
      setTimeout(() => setCopiedPurchaseNo(false), 2000);
    }
  };

  return createPortal(
    <div className="plan-dialog-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="plan-dialog-card voucher-details-dialog"
        style={{ maxWidth: 640, width: "94vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="plan-dialog-header">
          <div className="plan-dialog-header-left">
            <div
              className="plan-dialog-icon"
              style={{
                backgroundColor: "var(--primary-soft)",
                color: "var(--primary)",
                border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
              }}
            >
              <Icon name="payment" />
            </div>
            <div>
              <div
                className="plan-dialog-title-row"
                style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
              >
                <h2 className="plan-dialog-title font-mono" style={{ fontSize: 18 }}>
                  {purchase.purchase_number}
                </h2>
                <button
                  type="button"
                  onClick={() => handleCopy(purchase.purchase_number, "purchaseno")}
                  className="action-btn-icon"
                  title="Copy purchase number"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "var(--surface-muted)",
                    color: copiedPurchaseNo ? "var(--emerald-600, #059669)" : "var(--text-muted)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                >
                  <Icon name={copiedPurchaseNo ? "check" : "clipboard"} style={{ width: 13, height: 13 }} />
                </button>
                <Badge tone={purchaseStatusTone(purchase.status)} className="voucher-status-pill">
                  {purchaseStatusLabel(purchase.status)}
                </Badge>
              </div>
              <span className="plan-dialog-price">
                {purchase.status === "completed"
                  ? formatCurrencyAmount(purchase.final_amount)
                  : "Payment Incomplete"}
                <small style={{ marginLeft: 8, color: "var(--text-muted)", fontWeight: 500 }}>
                  · {formatDate(purchase.created_at)}
                </small>
              </span>
            </div>
          </div>
          <button type="button" className="plan-dialog-close" onClick={onClose} title="Close details">
            <Icon name="x" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="plan-dialog-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Voucher & Code Hero Banner */}
          <div
            style={{
              padding: "16px 18px",
              borderRadius: 14,
              background: "var(--surface-muted, #f8fafc)",
              border: "1px solid var(--border, #e2e8f0)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span className="voucher-type-pill" style={{ fontSize: 12, padding: "4px 10px" }}>
                  {purchase.voucher_type_name}
                </span>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 6, color: "var(--text, #0f172a)" }}>
                  {purchase.offering_title}
                </h3>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "rgba(0, 0, 0, 0.05)",
                  color: "var(--text-muted)",
                }}
              >
                {purchase.gateway || "GATEWAY"}
              </span>
            </div>

            {/* 16-Digit Code Display */}
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 10,
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
                  16-Digit Voucher Code
                </span>
                {purchase.status === "completed" ? (
                  <code
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: 16,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      color: "var(--text, #0f172a)",
                    }}
                  >
                    {purchase.voucher_code || purchase.raw_code || "—"}
                  </code>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>
                    {purchase.status === "pending"
                      ? "Pending payment verification — code will be issued automatically upon receipt"
                      : "No code assigned (Transaction not completed)"}
                  </span>
                )}
              </div>

              {purchase.status === "completed" && (purchase.voucher_code || purchase.raw_code) && (
                <button
                  type="button"
                  onClick={() => handleCopy(purchase.voucher_code || purchase.raw_code, "code")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    backgroundColor: copiedCode ? "var(--emerald-500, #10b981)" : "var(--primary-soft)",
                    color: copiedCode ? "#ffffff" : "var(--primary)",
                    border: copiedCode
                      ? "1px solid var(--emerald-600, #059669)"
                      : "1px solid color-mix(in srgb, var(--primary) 25%, transparent)",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Icon name={copiedCode ? "check" : "clipboard"} style={{ width: 14, height: 14 }} />
                  {copiedCode ? "Copied!" : "Copy Code"}
                </button>
              )}
            </div>
          </div>

          {/* Details 2-Column Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {/* Buyer Contact Card */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--primary)", fontWeight: 750, fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <Icon name="user" style={{ width: 15, height: 15 }} />
                Buyer Information
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Full Name</span>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{purchase.buyer_name}</div>
                </div>

                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Email Address</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{purchase.buyer_email}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(purchase.buyer_email, "email")}
                      title="Copy email"
                      style={{ background: "none", border: "none", cursor: "pointer", color: copiedEmail ? "#059669" : "var(--text-muted)", padding: 2 }}
                    >
                      <Icon name={copiedEmail ? "check" : "clipboard"} style={{ width: 13, height: 13 }} />
                    </button>
                  </div>
                </div>

                {purchase.buyer_phone && (
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>Phone Number</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, fontFamily: "var(--font-mono, monospace)", color: "var(--text)" }}>{purchase.buyer_phone}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(purchase.buyer_phone || "", "phone")}
                        title="Copy phone"
                        style={{ background: "none", border: "none", cursor: "pointer", color: copiedPhone ? "#059669" : "var(--text-muted)", padding: 2 }}
                      >
                        <Icon name={copiedPhone ? "check" : "clipboard"} style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment & Transaction Card */}
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 12,
                background: "var(--surface, #ffffff)",
                border: "1px solid var(--border, #e2e8f0)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--primary)", fontWeight: 750, fontSize: 12.5, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <Icon name="payment" style={{ width: 15, height: 15 }} />
                Payment & Billing
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Base Amount:</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                    {purchase.amount ? formatCurrencyAmount(purchase.amount) : "—"}
                  </span>
                </div>

                {Number(purchase.gst_amount) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>GST / Taxes:</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                      {formatCurrencyAmount(purchase.gst_amount)}
                    </span>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: 6,
                    borderTop: "1px dashed var(--border, #e2e8f0)",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 750, color: "var(--text)" }}>Total Paid:</span>
                  <span style={{ fontSize: 15, fontWeight: 850, color: "var(--primary)" }}>
                    {purchase.status === "completed"
                      ? formatCurrencyAmount(purchase.final_amount)
                      : "Not Paid"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Gateway:</span>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text)" }}>
                    {purchase.gateway || "N/A"}
                  </span>
                </div>

                {purchase.gateway_transaction_id && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Transaction ID:</span>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono, monospace)", color: "var(--text-muted)" }}>
                      {purchase.gateway_transaction_id}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            padding: "16px 20px",
            borderTop: "1px solid var(--border, #e2e8f0)",
            background: "var(--surface-muted, #f8fafc)",
            borderRadius: "0 0 20px 20px",
          }}
        >
          {purchase.status === "completed" && onViewInvoice && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewInvoice(purchase);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                backgroundColor: "rgba(2, 132, 199, 0.1)",
                color: "#0284c7",
                border: "1px solid rgba(2, 132, 199, 0.25)",
                cursor: "pointer",
              }}
            >
              <Icon name="filePdf" style={{ width: 15, height: 15 }} />
              View Tax Invoice
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              backgroundColor: "var(--surface, #ffffff)",
              color: "var(--text, #0f172a)",
              border: "1px solid var(--border, #cbd5e1)",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
