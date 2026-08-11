import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { useToastStore } from "@/store/toastStore";
import "@/styles/voucher-ui.css";
import { formatDate } from "@/utils/date";
import { loadRazorpayScript, openRazorpayCheckout } from "@/utils/razorpay";

interface VoucherOrder {
  online_payment: boolean;
  purchase_id: number;
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  offering_title: string;
  buyer_name: string;
  buyer_email: string;
}

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
  image_url?: string;
}

interface PurchaseSuccess {
  purchase_number: string;
  buyer_name: string;
  buyer_email: string;
  voucher_type: string;
  voucher_code: string;
  valid_until: string;
  final_amount: string;
}

export function VouchersSection() {
  const showError = useToastStore((state) => state.showError);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const [offerings, setOfferings] = useState<VoucherOffering[]>([]);
  const [loading, setLoading] = useState(true);

  // Checkout Modal State
  const [selectedOffering, setSelectedOffering] = useState<VoucherOffering | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Success Modal State
  const [purchaseSuccess, setPurchaseSuccess] = useState<PurchaseSuccess | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchOfferings = useCallback(async () => {
    try {
      const res = await api.get<VoucherOffering[]>("/vouchers/public/offerings");
      setOfferings(res.data || []);
    } catch (err) {
      console.error("Failed to load public vouchers", err);
      showError("Failed to load official exam vouchers.");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchOfferings();
  }, [fetchOfferings]);

  async function handlePurchaseSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOffering || !buyerName || !buyerEmail || !buyerPhone) return;

    setSubmitting(true);
    try {
      // Load the checkout script first; without it there is no way to pay, so
      // there is no point reserving a code.
      if (!(await loadRazorpayScript())) {
        showError("Could not load the payment window. Please try again.");
        setSubmitting(false);
        return;
      }

      // Step 1: reserve a code and open a real payment order. No code is issued
      // until the payment is verified below.
      const { data: order } = await api.post<VoucherOrder>("/vouchers/public/order", {
        offering_id: selectedOffering.id,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_phone: buyerPhone,
      });

      openRazorpayCheckout({
        keyId: order.key_id,
        orderId: order.order_id,
        amount: order.amount,
        currency: order.currency,
        description: order.offering_title,
        prefillName: buyerName,
        prefillEmail: buyerEmail,
        onSuccess: async (response) => {
          // Step 2: the backend verifies the signed receipt and only then
          // returns the code.
          try {
            const { data } = await api.post<PurchaseSuccess>("/vouchers/public/verify", {
              purchase_id: order.purchase_id,
              ...response,
            });
            setPurchaseSuccess(data);
            setSelectedOffering(null);
          } catch (err: any) {
            showError(err.response?.data?.detail || "We could not confirm your payment. If you were charged, contact support with your purchase reference.");
          } finally {
            setSubmitting(false);
          }
        },
        onDismiss: () => setSubmitting(false),
        onFailure: (message) => {
          showError(message);
          setSubmitting(false);
        },
      });
    } catch (err: any) {
      showError(err.response?.data?.detail || "Could not start the purchase. Please try again.");
      setSubmitting(false);
    }
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopied(true);
        showSuccess("Voucher code copied.");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => showError("Could not copy voucher code."));
  }

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400">
        Loading official exam vouchers...
      </div>
    );
  }

  if (offerings.length === 0) {
    return null;
  }

  return (
    <section className="voucher-ui-scope py-20 vh-pub-shell relative overflow-hidden" id="vouchers-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Book Your Exam Seats With Discounted Vouchers
          </h2>
          <p className="vh-pub-muted text-base">
            Get instant delivery of 16-digit official exam voucher codes for LanguageCert, Duolingo and more directly on your screen and email.
          </p>
        </div>

        {/* Voucher Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {offerings.map((vo) => (
            <div
              key={vo.id}
              className="vh-pub-card backdrop-blur-xl rounded-3xl border flex flex-col transition-all group overflow-hidden"
            >
              {vo.image_url && (
                <div className="w-full h-48 bg-slate-900 border-b border-slate-700/60 overflow-hidden shrink-0">
                  <img
                    src={vo.image_url}
                    alt={vo.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}
              
              <div className="p-7 flex flex-col justify-between flex-grow">
                <div className="flex justify-between items-center" style={{ minHeight: '28px' }}>
                  <span
                    className="px-3.5 py-1 text-xs font-bold text-white rounded-full uppercase tracking-wider"
                    style={{ backgroundColor: vo.voucher_type_badge_color }}
                  >
                    {vo.voucher_type_name}
                  </span>
                </div>

                <h3 className="text-xl font-extrabold vh-pub-title-hover transition-colors line-clamp-2" style={{ minHeight: '56px' }}>
                  {vo.title}
                </h3>
                
                <div style={{ minHeight: '40px' }}>
                  {vo.description && (
                    <p className="vh-pub-muted text-xs line-clamp-2 leading-relaxed">{vo.description}</p>
                  )}
                </div>

                <div className="pt-3 border-t vh-pub-divider mt-auto">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black">
                      ₹{parseFloat(vo.discount_price || vo.price).toLocaleString("en-IN")}
                    </span>
                    {vo.discount_price && (
                      <span className="text-sm vh-pub-muted line-through">
                        ₹{parseFloat(vo.price).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium vh-pub-muted mt-1 flex items-center gap-3">
                    <span>Validity: {vo.validity_days} Days</span>
                  </div>
                </div>
              </div>

              <div className="p-7 pt-0 mt-auto">
                <button
                  type="button"
                  onClick={() => setSelectedOffering(vo)}
                  disabled={vo.available_stock <= 0}
                  className="w-full vh-pub-cta font-bold py-3 px-4 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {vo.available_stock > 0 ? "Buy Voucher Code" : "Out of Stock"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {selectedOffering && (
        <div className="fixed inset-0 vh-pub-modal-backdrop backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50">
          <div className="vh-pub-modal-card relative rounded-3xl border p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-xs font-bold vh-pub-accent-text uppercase tracking-wider">{selectedOffering.voucher_type_name}</span>
                <h3 className="text-xl font-bold mt-1">Complete Voucher Purchase</h3>
              </div>
              <button
                onClick={() => setSelectedOffering(null)}
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors mt-0"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 vh-pub-summary-card rounded-2xl border flex justify-between items-center">
              <div>
                <div className="font-semibold text-sm">{selectedOffering.title}</div>
                <div className="text-xs vh-pub-muted">Validity: {selectedOffering.validity_days} Days</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black">
                  ₹{parseFloat(selectedOffering.discount_price || selectedOffering.price).toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold vh-pub-label mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-4 py-3 vh-pub-input border rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold vh-pub-label mb-1.5">Email Address (Voucher code sent here) *</label>
                <input
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full px-4 py-3 vh-pub-input border rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold vh-pub-label mb-1.5">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 9876543210"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full px-4 py-3 vh-pub-input border rounded-xl text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 vh-pub-cta disabled:opacity-50 font-bold rounded-xl text-sm transition-all shadow-lg mt-2"
              >
                {submitting ? "Processing Purchase..." : `Pay ₹${parseFloat(selectedOffering.discount_price || selectedOffering.price).toLocaleString("en-IN")} & Get Code`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL WITH 16-DIGIT CODE */}
      {purchaseSuccess && (
        <div className="fixed inset-0 vh-pub-modal-backdrop backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50">
          <div className="vh-pub-modal-card vh-pub-modal-card-accent relative rounded-3xl border p-6 sm:p-8 max-w-lg w-full shadow-2xl text-center space-y-6 m-4 max-h-[90vh] overflow-y-auto">
            <div>
              <h3 className="text-2xl font-black">Voucher Purchased Successfully</h3>
              <p className="text-xs vh-pub-muted mt-1">
                A confirmation email with code details has been sent to <strong>{purchaseSuccess.buyer_email}</strong>.
              </p>
            </div>

            <div className="p-6 vh-pub-code-box border-2 border-dashed rounded-2xl space-y-3">
              <div className="text-xs font-bold vh-pub-accent-text uppercase tracking-widest">
                16-Digit Voucher Code ({purchaseSuccess.voucher_type})
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-widest break-all">
                {purchaseSuccess.voucher_code}
              </div>
              <button
                onClick={() => handleCopyCode(purchaseSuccess.voucher_code)}
                className="px-4 py-2 vh-pub-copy-btn font-semibold text-xs rounded-xl transition-all flex items-center gap-2 mx-auto"
              >
                <span>{copied ? "Copied to Clipboard" : "Copy Code"}</span>
              </button>
            </div>

            <div className="text-xs vh-pub-muted vh-pub-detail-box space-y-1 text-left p-4 rounded-xl">
              <div><strong>Purchase Ref:</strong> {purchaseSuccess.purchase_number}</div>
              <div><strong>Valid Until:</strong> {formatDate(purchaseSuccess.valid_until)}</div>
              <div><strong>Amount Paid:</strong> ₹{parseFloat(purchaseSuccess.final_amount).toLocaleString("en-IN")}</div>
            </div>

            <button
              onClick={() => setPurchaseSuccess(null)}
              className="w-full py-3 vh-pub-done-btn border font-bold text-sm rounded-xl transition-all"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
