import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { Button, Modal } from "@/components/ui";
import { loadRazorpayScript, openRazorpayCheckout } from "@/utils/razorpay";
import "@/styles/voucher-ui.css";
import { formatDate } from "@/utils/date";
import { formatCurrencyAmount } from "@/utils/currency";

interface VoucherOffering {
  id: number;
  voucher_type_name: string;
  voucher_type_code: string;
  voucher_type_badge_color: string;
  title: string;
  description?: string;
  price: string;
  discount_price?: string;
  validity_days: number;
  gst_percentage: string;
  is_active: boolean;
  available_stock: number;
}

interface StudentVoucher {
  id: number;
  purchase_number: string;
  offering_title: string;
  voucher_type_name: string;
  voucher_type_badge_color: string;
  voucher_code: string;
  raw_code: string;
  buyer_name: string;
  buyer_email: string;
  final_amount: string;
  created_at: string;
  valid_until?: string;
  is_expired: boolean;
  gateway: string;
  status: string;
}

export function StudentVouchers() {
  const user = useAuthStore((state) => state.user);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [activeTab, setActiveTab] = useState<"browse" | "my_vouchers">("browse");
  const [offerings, setOfferings] = useState<VoucherOffering[]>([]);
  const [myVouchers, setMyVouchers] = useState<StudentVoucher[]>([]);
  const [loading, setLoading] = useState(true);

  // Mask/Reveal toggles per voucher ID
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Purchasing state
  const [purchasingId, setPurchasingId] = useState<number | null>(null);

  // Selected Invoice Modal
  const [selectedInvoice, setSelectedInvoice] = useState<StudentVoucher | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, vRes] = await Promise.all([
        api.get<VoucherOffering[]>("/vouchers/public/offerings"),
        api.get<StudentVoucher[]>("/vouchers/student/my-vouchers").catch(() => ({ data: [] })),
      ]);
      setOfferings(oRes.data || []);
      setMyVouchers(vRes.data || []);
      if (vRes.data && vRes.data.length > 0) {
        setActiveTab("my_vouchers");
      } else {
        setActiveTab("browse");
      }
    } catch (err) {
      console.error("Failed to load student vouchers", err);
      showError("Failed to load vouchers.");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleReveal(id: number) {
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleCopy(id: number, code: string) {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopiedId(id);
        showSuccess("Voucher code copied to clipboard.");
        setTimeout(() => setCopiedId(null), 2500);
      })
      .catch(() => showError("Could not copy voucher code."));
  }

  async function handleBuyNow(offering: VoucherOffering) {
    if (!user) return;
    setPurchasingId(offering.id);
    try {
      const buyerName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

      if (!(await loadRazorpayScript())) {
        showError("Could not load the payment gateway. Please disable ad-blockers and try again.");
        setPurchasingId(null);
        return;
      }

      // Step 1: reserve a code and open a payment order tied to this student
      const { data: order } = await api.post("/vouchers/student/order", {
        offering_id: offering.id,
        buyer_name: buyerName,
        buyer_email: user.email,
        buyer_phone: user.phone_number || null,
      });

      const cancelPendingPurchase = async () => {
        try {
          await api.post("/vouchers/student/cancel", {
            purchase_id: order.purchase_id,
            razorpay_order_id: order.order_id,
          });
          fetchData();
        } catch (err) {
          console.warn("Could not cancel pending voucher purchase", err);
        }
      };

      let paymentSucceeded = false;
      openRazorpayCheckout({
        keyId: order.key_id,
        orderId: order.order_id,
        amount: order.amount,
        currency: order.currency,
        description: order.offering_title,
        prefillName: buyerName,
        prefillEmail: user.email,
        onSuccess: async (response) => {
          paymentSucceeded = true;
          try {
            // Step 2: verify the receipt, then release code
            await api.post("/vouchers/student/verify", {
              purchase_id: order.purchase_id,
              ...response,
            });
            showSuccess("Payment verified! Your exam voucher is ready.");
            fetchData();
            setActiveTab("my_vouchers");
          } catch (err: any) {
            showError(
              err.response?.data?.detail || "We could not confirm your payment. Please contact support if debited."
            );
          } finally {
            setPurchasingId(null);
          }
        },
        onDismiss: () => {
          if (!paymentSucceeded) {
            void cancelPendingPurchase();
          }
          setPurchasingId(null);
        },
        onFailure: (message) => {
          showError(message);
          void cancelPendingPurchase();
          setPurchasingId(null);
        },
      });
    } catch (err: any) {
      showError(err.response?.data?.detail || "Could not initiate purchase. Please try again.");
      setPurchasingId(null);
    }
  }

  function getMaskedCode(code: string) {
    if (!code) return "••••-••••-••••-••••";
    const clean = code.replace(/-/g, "");
    if (clean.length >= 16) {
      return `••••-••••-••••-${clean.slice(12)}`;
    }
    return "••••-••••-••••-••••";
  }

  function calculateSavings(priceStr: string, discountPriceStr?: string) {
    if (!discountPriceStr) return null;
    const p = parseFloat(priceStr);
    const dp = parseFloat(discountPriceStr);
    if (isNaN(p) || isNaN(dp) || p <= dp) return null;
    const diff = p - dp;
    const pct = Math.round((diff / p) * 100);
    return { diff, pct };
  }

  return (
    <div className="sv-portal-container">
      {/* Header Banner */}
      <div className="sv-hero-banner">
        <div className="sv-hero-content">
          <h1 className="sv-hero-title">Official Test Vouchers</h1>
          <p className="sv-hero-desc">
            Save on exam registration fees for LanguageCert, PTE, Duolingo & IELTS with guaranteed 16-digit instant delivery.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="sv-tab-switcher">
          <button
            type="button"
            className={`sv-tab-btn ${activeTab === "browse" ? "is-active" : ""}`}
            onClick={() => setActiveTab("browse")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
            <span>Browse Vouchers</span>
          </button>

          <button
            type="button"
            className={`sv-tab-btn ${activeTab === "my_vouchers" ? "is-active" : ""}`}
            onClick={() => setActiveTab("my_vouchers")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 8v13H3V8" />
              <path d="M1 3h22v5H1z" />
              <path d="M10 12h4" />
            </svg>
            <span>My Purchased Vouchers</span>
            {myVouchers.length > 0 && <span className="sv-tab-count">{myVouchers.length}</span>}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="sv-loading-state">
          <div className="sv-loading-spinner" />
          <p>Loading available exam vouchers...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: BROWSE VOUCHERS */}
          {activeTab === "browse" && (
            <div className="sv-grid">
              {offerings.length === 0 ? (
                <div className="sv-empty-box">
                  <div className="sv-empty-icon">🎟️</div>
                  <h3>No Vouchers Available</h3>
                  <p>Check back soon as new exam registration vouchers are added regularly.</p>
                </div>
              ) : (
                offerings.map((vo) => {
                  const finalPrice = vo.discount_price || vo.price;
                  const savings = calculateSavings(vo.price, vo.discount_price);
                  const inStock = vo.available_stock > 0;
                  const isPurchasing = purchasingId === vo.id;

                  return (
                    <div key={vo.id} className={`sv-card ${!inStock ? "is-out-of-stock" : ""}`}>
                      {/* Top Header Row */}
                      <div className="sv-card-top">
                        <div className="sv-exam-header-left">
                          <span className="sv-exam-indicator-dot" />
                          <span className="sv-exam-title-tag">
                            {vo.voucher_type_name}
                          </span>
                        </div>

                        <div className="sv-official-badge">
                          <span>OFFICIAL EXAM</span>
                        </div>
                      </div>

                      {/* Main Title & Description */}
                      <div className="sv-card-body">
                        <h3 className="sv-card-title">{vo.title}</h3>
                        <p className="sv-card-desc">
                          {vo.description ||
                            "Official exam registration voucher code with instant 16-digit verification."}
                        </p>

                        {/* Inclusions list */}
                        <div className="sv-inclusions">
                          <div className="sv-inc-item">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                            <span>
                              <strong>{vo.validity_days} Days</strong> Validity
                            </span>
                          </div>
                          <div className="sv-inc-item">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                            <span>16-Digit Instant Redemption Code</span>
                          </div>
                          <div className="sv-inc-item">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                            <span>100% Guaranteed Official Exam Booking</span>
                          </div>
                        </div>
                      </div>

                      {/* Price Section with realistic discount tag and RED instant delivery at bottom */}
                      <div className="sv-card-price-section">
                        <div className="sv-price-row">
                          <div className="sv-price-main">
                            <span className="sv-price-val">{formatCurrencyAmount(finalPrice)}</span>
                            {savings && (
                              <span className="sv-price-old">{formatCurrencyAmount(vo.price)}</span>
                            )}
                          </div>
                          {savings && (
                            <span className="sv-savings-text">
                              Save {formatCurrencyAmount(savings.diff)} ({savings.pct}% OFF)
                            </span>
                          )}
                        </div>

                        <div className="sv-card-meta-bottom">
                          <div className="sv-delivery-status-red">
                            <span className="sv-live-dot-red" />
                            <span className="sv-delivery-label-red">Instant Delivery</span>
                          </div>
                          <div className="sv-tax-hint">Incl. all taxes</div>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <div className="sv-card-footer">
                        {inStock ? (
                          <button
                            type="button"
                            className="sv-btn-buy"
                            onClick={() => handleBuyNow(vo)}
                            disabled={isPurchasing}
                          >
                            {isPurchasing ? (
                              <>
                                <span className="sv-btn-spinner" />
                                <span>Opening Payment...</span>
                              </>
                            ) : (
                              <>
                                <span>Buy Voucher Now</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                              </>
                            )}
                          </button>
                        ) : (
                          <button type="button" className="sv-btn-out-of-stock" disabled>
                            Out of Stock
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: MY PURCHASED VOUCHERS */}
          {activeTab === "my_vouchers" && (
            <div className="sv-grid">
              {myVouchers.length === 0 ? (
                <div className="sv-empty-box">
                  <div className="sv-empty-icon">🎟️</div>
                  <h3>No Vouchers Purchased Yet</h3>
                  <p>You haven't bought any test vouchers yet. Browse available exam vouchers to get instant discounts.</p>
                  <button type="button" className="sv-btn-browse-empty" onClick={() => setActiveTab("browse")}>
                    Browse Vouchers Now →
                  </button>
                </div>
              ) : (
                myVouchers.map((v) => {
                  const isRevealed = revealedIds[v.id];
                  const isCopied = copiedId === v.id;

                  return (
                    <div key={v.id} className="sv-card sv-purchased-card">
                      {/* Top Header - Clean realistic layout */}
                      <div className="sv-card-top">
                        <div className="sv-exam-header-left">
                          <span className="sv-exam-indicator-dot" />
                          <span className="sv-exam-title-tag">
                            {v.voucher_type_name}
                          </span>
                        </div>

                        <span className={`sv-status-badge ${v.is_expired ? "is-expired" : "is-active"}`}>
                          <span className={`sv-status-dot ${v.is_expired ? "is-expired" : "is-active"}`} />
                          {v.is_expired ? "Expired" : "Active & Ready"}
                        </span>
                      </div>

                      {/* Offering Title & Reference */}
                      <div className="sv-card-body">
                        <h3 className="sv-card-title">{v.offering_title}</h3>
                        <div className="sv-ref-tag">
                          <span>Ref:</span>
                          <code>{v.purchase_number}</code>
                        </div>

                        {/* 16-Digit Code Box */}
                        <div className="sv-code-container">
                          <div className="sv-code-header">
                            <span>16-DIGIT VOUCHER CODE</span>
                            <span className="sv-code-sec-icon">🔒 Secure Code</span>
                          </div>

                          <div className="sv-code-display">
                            {isRevealed ? v.voucher_code : getMaskedCode(v.voucher_code)}
                          </div>

                          <div className="sv-code-actions">
                            <button
                              type="button"
                              className="sv-code-btn"
                              onClick={() => toggleReveal(v.id)}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                {isRevealed ? (
                                  <>
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                  </>
                                ) : (
                                  <>
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </>
                                )}
                              </svg>
                              <span>{isRevealed ? "Hide Code" : "Reveal Code"}</span>
                            </button>

                            <button
                              type="button"
                              className={`sv-code-btn sv-copy-btn ${isCopied ? "is-copied" : ""}`}
                              onClick={() => handleCopy(v.id, v.voucher_code)}
                            >
                              {isCopied ? (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                  </svg>
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                  </svg>
                                  <span>Copy Code</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Meta Rows */}
                        <div className="sv-purchased-meta">
                          <div className="sv-meta-row">
                            <span>Valid Until:</span>
                            <strong>{v.valid_until ? formatDate(v.valid_until) : "Lifetime"}</strong>
                          </div>
                          <div className="sv-meta-row">
                            <span>Amount Paid:</span>
                            <strong>{formatCurrencyAmount(v.final_amount)}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="sv-card-footer">
                        <button
                          type="button"
                          className="sv-btn-invoice"
                          onClick={() => setSelectedInvoice(v)}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                          <span>View Tax Invoice</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {/* STUDENT TAX INVOICE MODAL */}
      <Modal
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Official Tax Invoice"
      >
        {selectedInvoice && (
          <div className="voucher-invoice-modal">
            {/* Watermark Logo */}
            <div className="voucher-invoice-watermark">
              <img src="/brand/vh-mark-96.png" alt="Visa House Watermark" />
            </div>

            <div className="voucher-invoice-print-header">
              <div className="voucher-invoice-brand-row">
                <img src="/brand/vh-mark-96.png" alt="Visa House Logo" className="voucher-invoice-logo" />
                <div className="voucher-invoice-brand-text">
                  <h2>VISA HOUSE</h2>
                  <p>Official Exam Voucher Purchase Receipt</p>
                </div>
              </div>
            </div>

            <div className="voucher-invoice-card">
              <div className="voucher-invoice-row">
                <span className="voucher-invoice-label">Billed To:</span>
                <span className="voucher-invoice-value">
                  {selectedInvoice.buyer_name} ({selectedInvoice.buyer_email})
                </span>
              </div>
              <div className="voucher-invoice-row">
                <span className="voucher-invoice-label">Date:</span>
                <span className="voucher-invoice-value">{formatDate(selectedInvoice.created_at)}</span>
              </div>
              <div className="voucher-invoice-row">
                <span className="voucher-invoice-label">Gateway:</span>
                <span className="voucher-invoice-value">{selectedInvoice.gateway.toUpperCase()}</span>
              </div>
            </div>

            <div className="voucher-invoice-code-box">
              <div className="voucher-invoice-code-title">16-Digit Voucher Code</div>
              <div className="voucher-invoice-code-text">{selectedInvoice.voucher_code}</div>
            </div>

            <div className="voucher-invoice-summary">
              <div className="voucher-invoice-row">
                <span className="voucher-invoice-label">Voucher Type:</span>
                <span className="voucher-invoice-value">{selectedInvoice.voucher_type_name}</span>
              </div>
              <div className="voucher-invoice-row">
                <span className="voucher-invoice-label">Invoice Number:</span>
                <span className="voucher-invoice-value">{selectedInvoice.purchase_number}</span>
              </div>
              <div className="voucher-invoice-total-row">
                <span>Total Paid:</span>
                <span>{formatCurrencyAmount(selectedInvoice.final_amount)}</span>
              </div>
            </div>

            <div className="voucher-invoice-actions">
              <Button variant="secondary" onClick={() => setSelectedInvoice(null)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                Print / Save Invoice
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
