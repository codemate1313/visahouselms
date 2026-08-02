import { useState, type FormEvent } from "react";
import type { StudentPlanCatalogItem } from "@/api/types";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { formatCurrencyAmount } from "@/utils/currency";
import { Button } from "@/components/ui/Button/Button";

interface CheckoutModalProps {
  plan: StudentPlanCatalogItem;
  selectedCurrency?: "INR" | "USD";
  couponCode: string;
  onCouponCodeChange: (value: string) => void;
  buying: boolean;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
}


const MODULE_TYPE_LABELS: Record<string, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
  general_listening: "Gen. Listening",
  general_reading: "Gen. Reading",
};

const MODULE_TYPE_COLORS: Record<string, string> = {
  listening: "#2563eb",
  reading: "#7c3aed",
  writing: "#059669",
  speaking: "#ea580c",
  general_listening: "#0891b2",
  general_reading: "#9333ea",
};

// SVG icon components
function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}


function IconShield() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconCard() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function CheckoutModal({ plan, selectedCurrency = "INR", couponCode, onCouponCodeChange, buying, onSubmit, onClose }: CheckoutModalProps) {
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    discountType: string | null;
    discountValue: number | null;
    discountedBasePrice: number;
    subtotal: number;
    gstAmount: number;
    finalTotal: number;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const isUSD = selectedCurrency === "USD" && plan.is_international_enabled && plan.usd_price;
  const currencyCode = isUSD ? "USD" : (plan.currency || "INR");
  const basePrice = parseFloat(isUSD ? (plan.usd_price || "0") : plan.price) || 0;
  const gst = isUSD ? null : plan.gst_rate;
  let gstAmount = 0;
  let subtotal = basePrice;
  let finalTotal = basePrice;

  if (appliedCoupon) {
    gstAmount = appliedCoupon.gstAmount;
    subtotal = appliedCoupon.subtotal;
    finalTotal = appliedCoupon.finalTotal;
  } else if (gst && gst.percentage > 0) {
    if (gst.tax_type === "inclusive") {
      finalTotal = basePrice;
      subtotal = finalTotal / (1 + gst.percentage / 100);
      gstAmount = finalTotal - subtotal;
    } else {
      subtotal = basePrice;
      gstAmount = subtotal * (gst.percentage / 100);
      finalTotal = subtotal + gstAmount;
    }
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const { data } = await apiClient.post<{
        valid: boolean;
        coupon_code: string;
        discount_amount: number;
        discount_type: string | null;
        discount_value: number | null;
        discounted_base_price: number;
        subtotal: number;
        gst_amount: number;
        final_total: number;
      }>(`/student/plans/${plan.id}/validate-coupon`, {
        coupon_code: couponCode.trim(),
        currency: selectedCurrency,
      });

      setAppliedCoupon({
        code: data.coupon_code,
        discountAmount: data.discount_amount,
        discountType: data.discount_type,
        discountValue: data.discount_value,
        discountedBasePrice: data.discounted_base_price,
        subtotal: data.subtotal,
        gstAmount: data.gst_amount,
        finalTotal: data.final_total,
      });
      setCouponError(null);
    } catch (err: unknown) {
      setAppliedCoupon(null);
      setCouponError(extractErrorMessage(err, "Invalid coupon code"));
    } finally {
      setValidatingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
    onCouponCodeChange("");
  }


  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card catalog-checkout-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.12)",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(145deg, #a31c28 0%, #c8202e 55%, #dc2626 100%)",
          padding: "14px 24px 12px",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.18)",
                color: "rgba(255,255,255,0.92)",
                fontSize: "9.5px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                padding: "2px 8px",
                borderRadius: "20px",
                textTransform: "uppercase",
                marginBottom: "4px",
                border: "1px solid rgba(255,255,255,0.2)",
              }}>Plan Purchase</span>
              <h2 style={{
                fontSize: "20px",
                fontWeight: 800,
                margin: 0,
                color: "#fff",
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>{plan.name}</h2>
              {plan.description && (
                <p style={{
                  fontSize: "11.5px",
                  color: "rgba(255,255,255,0.7)",
                  margin: "3px 0 0",
                  lineHeight: 1.3,
                }}>
                  {plan.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.2)",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s",
              }}
            >
              <IconClose />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "14px 24px 16px", background: "var(--surface)" }}>

          {/* Price + Validity Row */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "10px",
            padding: "10px 14px",
            background: "var(--surface-muted)",
            border: "1.5px solid var(--border)",
            borderRadius: "12px",
            marginBottom: "8px",
          }}>
            <div>
              <div style={{
                fontSize: "9.5px",
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: "3px",
              }}>Total Amount</div>
              <div style={{
                fontSize: "24px",
                fontWeight: 900,
                color: "#c8202e",
                lineHeight: 1,
              }}>
                {formatCurrencyAmount(finalTotal, currencyCode)}
              </div>
              <div style={{
                fontSize: "10.5px",
                color: "var(--text-muted)",
                marginTop: "3px",
                fontWeight: 500,
              }}>
                {appliedCoupon && appliedCoupon.discountAmount > 0 ? (
                  <span className="ui-text-success ui-text-strong">
                    Discount of {formatCurrencyAmount(appliedCoupon.discountAmount, currencyCode)} applied!
                  </span>
                ) : gst && gst.percentage > 0 ? (
                  gst.tax_type === "inclusive"
                    ? `Includes ${gst.name} (${gst.percentage}%)`
                    : `Base ${formatCurrencyAmount(basePrice, currencyCode)} + ${gst.percentage}% GST`
                ) : (
                  "One-time payment · No hidden fees"
                )}
              </div>
            </div>

            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: "2px",
            }}>
              <div style={{
                fontSize: "9.5px",
                fontWeight: 700,
                color: "var(--text-muted)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}>Validity</div>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--surface)",
                border: "1.5px solid #e8ecef",
                borderRadius: "8px",
                padding: "5px 10px",
              }}>
                <span style={{ color: "var(--text-muted)" }}><IconCalendar /></span>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "16px", fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>{plan.duration_days}</div>
                  <div style={{ fontSize: "8.5px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>days</div>
                </div>
              </div>
            </div>
          </div>

          {/* GST Tax Breakdown Detail Card */}
          {(gst && gst.percentage > 0 || (appliedCoupon && appliedCoupon.discountAmount > 0)) && (
            <div style={{
              background: "color-mix(in srgb, var(--danger) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--danger) 24%, transparent)",
              borderRadius: "10px",
              padding: "8px 12px",
              marginBottom: "8px",
              fontSize: "11.5px",
            }}>
              <div style={{ fontWeight: 800, color: "var(--danger)", marginBottom: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Price & Tax Breakdown</span>
                {gst && gst.percentage > 0 && (
                  <span style={{
                    fontSize: "9.5px",
                    padding: "1px 6px",
                    borderRadius: "8px",
                    background: gst.tax_type === "inclusive" ? "color-mix(in srgb, var(--info, #2563eb) 12%, transparent)" : "color-mix(in srgb, var(--danger) 12%, transparent)",
                    color: gst.tax_type === "inclusive" ? "var(--info, #2563eb)" : "var(--danger)",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}>
                    {gst.tax_type === "inclusive" ? "Inclusive GST" : "Exclusive GST"}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "2px" }}>
                <span>Base Price:</span>
                <span>{formatCurrencyAmount(basePrice, currencyCode)}</span>
              </div>
              {appliedCoupon && appliedCoupon.discountAmount > 0 && (
                <div className="ui-text-success" style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginBottom: "2px" }}>
                  <span>Coupon Discount ({appliedCoupon.code}):</span>
                  <span>-{formatCurrencyAmount(appliedCoupon.discountAmount, currencyCode)}</span>
                </div>
              )}
              {gst && gst.percentage > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", marginBottom: "4px" }}>
                  <span>{gst.name} ({gst.percentage}%):</span>
                  <span>+{formatCurrencyAmount(gstAmount, currencyCode)}</span>
                </div>
              )}
              <div style={{ borderTop: "1px dashed #fca5a5", paddingTop: "4px", display: "flex", justifyContent: "space-between", fontWeight: 800, color: "var(--text)" }}>
                <span>Total Payable:</span>
                <span>{formatCurrencyAmount(finalTotal, currencyCode)}</span>
              </div>
            </div>
          )}

          {/* What's Included */}
          <div style={{
            border: "1.5px solid var(--border)",
            borderRadius: "10px",
            marginBottom: "8px",
            overflow: "hidden",
          }}>
            {/* Section header */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "7px 12px",
              background: "var(--surface-muted)",
              borderBottom: plan.modules.length > 0 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ color: "var(--text-muted)" }}><IconBox /></span>
                <span style={{ fontSize: "11.5px", fontWeight: 800, color: "var(--text)" }}>
                  What's Included
                </span>
              </div>
              <span style={{
                background: "#c8202e",
                color: "#fff",
                fontSize: "9.5px",
                fontWeight: 800,
                borderRadius: "20px",
                padding: "2px 8px",
              }}>
                {plan.module_count} {plan.module_count === 1 ? "Test" : "Tests"}
              </span>
            </div>

            {/* Module list */}
            {plan.modules.length > 0 ? (
              <div style={{ padding: "6px 10px", display: "flex", flexDirection: "column", gap: "4px", background: "var(--surface)" }}>
                {plan.modules.map((mod, idx) => {
                  const color = MODULE_TYPE_COLORS[mod.module_type] ?? "#475569";
                  const label = MODULE_TYPE_LABELS[mod.module_type] ?? mod.module_type;
                  return (
                    <div key={idx} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      background: "var(--surface-muted)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{
                          display: "inline-block",
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: color,
                          flexShrink: 0,
                        }} />
                        <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--text)" }}>{mod.title}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                          fontSize: "9px",
                          fontWeight: 800,
                          background: color + "15",
                          color,
                          borderRadius: "5px",
                          padding: "1px 6px",
                          textTransform: "uppercase",
                        }}>{label}</span>
                        <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 600 }}>{mod.duration_minutes}m</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "8px 12px", fontSize: "11.5px", color: "var(--text-muted)", background: "var(--surface)" }}>
                {plan.module_count} test module{plan.module_count !== 1 ? "s" : ""} included
              </div>
            )}
          </div>

          {/* Trust Badges */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "6px",
            marginBottom: "8px",
          }}>
            {[
              { icon: <IconShield />, label: "Secure Payment", sub: "256-bit SSL" },
              { icon: <IconZap />, label: "Instant Access", sub: "After payment" },
              { icon: <IconCard />, label: "All Methods", sub: "Card · UPI · Net" },
            ].map((b) => (
              <div key={b.label} style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                background: "var(--surface-muted)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
              }}>
                <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{b.icon}</span>
                <div>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{b.label}</div>
                  <div style={{ fontSize: "8.5px", color: "var(--text-muted)", marginTop: "2px" }}>{b.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit}>
            {/* Coupon input & button */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <input
                  id="coupon"
                  value={couponCode}
                  onChange={(e) => {
                    onCouponCodeChange(e.target.value.toUpperCase());
                    if (appliedCoupon && e.target.value.toUpperCase() !== appliedCoupon.code) {
                      setAppliedCoupon(null);
                    }
                    if (couponError) setCouponError(null);
                  }}
                  placeholder="ENTER COUPON CODE (OPTIONAL)"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: `1.5px solid ${couponError ? "#f87171" : appliedCoupon ? "#4ade80" : "#e8ecef"}`,
                    borderRadius: "9px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    outline: "none",
                    color: "var(--text)",
                    boxSizing: "border-box",
                    background: appliedCoupon ? "#f0fdf4" : "#fafafa",
                    transition: "all 0.15s",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyCoupon();
                    }
                  }}
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    style={{
                      padding: "8px 14px",
                      background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--danger) 26%, transparent)",
                      color: "var(--danger)",
                      borderRadius: "9px",
                      fontSize: "11px",
                      fontWeight: 800,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={!couponCode.trim() || validatingCoupon}
                    style={{
                      padding: "8px 16px",
                      background: couponCode.trim() ? "#c8202e" : "#e2e8f0",
                      border: "none",
                      color: couponCode.trim() ? "#fff" : "#94a3b8",
                      borderRadius: "9px",
                      fontSize: "11px",
                      fontWeight: 800,
                      cursor: couponCode.trim() ? "pointer" : "not-allowed",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s",
                    }}
                  >
                    {validatingCoupon ? "Validating..." : "APPLY"}
                  </button>
                )}
              </div>

              {/* Success Badge */}
              {appliedCoupon && (
                <div className="ui-coupon-message ui-coupon-message-success">
                  <span>
                    Coupon <strong>{appliedCoupon.code}</strong> applied. You saved {formatCurrencyAmount(appliedCoupon.discountAmount, currencyCode)}
                  </span>
                </div>
              )}

              {/* Error Message */}
              {couponError && (
                <div className="ui-coupon-message ui-coupon-message-error">
                  {couponError}
                </div>
              )}
            </div>

            {/* Gateway Notice */}
            <div
              className={`ui-inline-notice ${isUSD ? "ui-inline-notice-info" : ""}`}
              style={{ padding: "7px 11px", marginBottom: "10px" }}
            >
              <span style={{ flexShrink: 0 }}><IconInfo /></span>
              <span>
                {isUSD ? (
                  <>Processed globally via <strong>Stripe's</strong> secure 256-bit encrypted gateway (Visa, MC, Amex, Apple Pay).</>
                ) : (
                  <>Redirects to <strong style={{ color: "var(--text)" }}>Razorpay's</strong> secure payment gateway (UPI, Cards, NetBanking).</>
                )}
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: "0 0 auto",
                  padding: "10px 18px",
                  border: "1.5px solid var(--border)",
                  background: "var(--surface)",
                  borderRadius: "9px",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#94a3b8"; e.currentTarget.style.color = "#1e293b"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
              >
                Cancel
              </button>
              <Button
                type="submit"
                variant="primary"
                loading={buying}
                className="catalog-plan-btn"
                style={{
                  flex: 1,
                  borderRadius: "9px",
                  fontSize: "13.5px",
                  padding: "10px 18px",
                  fontWeight: 800,
                } as React.CSSProperties}
              >
                {buying ? "Processing..." : `Pay ${formatCurrencyAmount(finalTotal, currencyCode)}`}
              </Button>

            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
