import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { useToastStore } from "@/store/toastStore";
import "@/styles/voucher-ui.css";
import { formatDate } from "@/utils/date";

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
    if (!selectedOffering || !buyerName || !buyerEmail) return;

    setSubmitting(true);
    try {
      const res = await api.post<PurchaseSuccess>("/vouchers/public/purchase", {
        offering_id: selectedOffering.id,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_phone: buyerPhone || null,
        gateway: "demo",
      });

      setPurchaseSuccess(res.data);
      setSelectedOffering(null);
    } catch (err: any) {
      showError(err.response?.data?.detail || "Voucher purchase failed. Please try again.");
    } finally {
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
    <section className="voucher-ui-scope py-20 bg-slate-900 text-white relative overflow-hidden" id="vouchers-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold uppercase tracking-wider">
            <span>Official Exam Vouchers</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Book Your Exam Seats With Discounted Vouchers
          </h2>
          <p className="text-slate-400 text-base">
            Get instant delivery of 16-digit official exam voucher codes for IELTS, PTE, and more directly on your screen and email.
          </p>
        </div>

        {/* Voucher Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {offerings.map((vo) => (
            <div
              key={vo.id}
              className="bg-slate-800/80 backdrop-blur-xl rounded-3xl border border-slate-700/60 p-7 flex flex-col justify-between hover:border-sky-500/50 hover:shadow-2xl hover:shadow-sky-500/10 transition-all group"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span
                    className="px-3.5 py-1 text-xs font-bold text-white rounded-full uppercase tracking-wider"
                    style={{ backgroundColor: vo.voucher_type_badge_color }}
                  >
                    {vo.voucher_type_name}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Instant Email Code
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-white group-hover:text-sky-400 transition-colors">
                  {vo.title}
                </h3>
                {vo.description && (
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed">{vo.description}</p>
                )}

                <div className="pt-3 border-t border-slate-700/50">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white">
                      ₹{parseFloat(vo.discount_price || vo.price).toLocaleString("en-IN")}
                    </span>
                    {vo.discount_price && (
                      <span className="text-sm text-slate-500 line-through">
                        ₹{parseFloat(vo.price).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-medium text-slate-400 mt-1 flex items-center gap-3">
                    <span>Validity: {vo.validity_days} Days</span>
                    <span>•</span>
                    <span>16-Digit Code</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <button
                  onClick={() => setSelectedOffering(vo)}
                  disabled={vo.available_stock <= 0}
                  className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2"
                >
                  {vo.available_stock > 0 ? "Buy Voucher Now" : "Out of Stock"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CHECKOUT MODAL */}
      {selectedOffering && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-3xl border border-slate-800 p-8 max-w-md w-full shadow-2xl space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">{selectedOffering.voucher_type_name}</span>
                <h3 className="text-xl font-bold text-white mt-1">Complete Voucher Purchase</h3>
              </div>
              <button
                onClick={() => setSelectedOffering(null)}
                className="text-slate-400 hover:text-white p-1 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex justify-between items-center">
              <div>
                <div className="font-semibold text-white text-sm">{selectedOffering.title}</div>
                <div className="text-xs text-slate-400">Validity: {selectedOffering.validity_days} Days</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-white">
                  ₹{parseFloat(selectedOffering.discount_price || selectedOffering.price).toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your full name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address (Voucher code sent here) *</label>
                <input
                  type="email"
                  required
                  placeholder="your.email@example.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Phone Number (Optional)</label>
                <input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-sky-500/30 mt-2"
              >
                {submitting ? "Processing Purchase..." : `Pay ₹${parseFloat(selectedOffering.discount_price || selectedOffering.price).toLocaleString("en-IN")} & Get Code`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL WITH 16-DIGIT CODE */}
      {purchaseSuccess && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-3xl border border-sky-500/30 p-8 max-w-lg w-full shadow-2xl text-center space-y-6">
            <div>
              <h3 className="text-2xl font-black text-white">Voucher Purchased Successfully</h3>
              <p className="text-xs text-slate-400 mt-1">
                A confirmation email with code details has been sent to <strong>{purchaseSuccess.buyer_email}</strong>.
              </p>
            </div>

            <div className="p-6 bg-slate-800/80 border-2 border-dashed border-sky-500/50 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-sky-400 uppercase tracking-widest">
                16-Digit Voucher Code ({purchaseSuccess.voucher_type})
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-widest break-all">
                {purchaseSuccess.voucher_code}
              </div>
              <button
                onClick={() => handleCopyCode(purchaseSuccess.voucher_code)}
                className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 font-semibold text-xs rounded-xl transition-all flex items-center gap-2 mx-auto"
              >
                <span>{copied ? "Copied to Clipboard" : "Copy Code"}</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 space-y-1 text-left bg-slate-800/40 p-4 rounded-xl">
              <div><strong>Purchase Ref:</strong> {purchaseSuccess.purchase_number}</div>
              <div><strong>Valid Until:</strong> {formatDate(purchaseSuccess.valid_until)}</div>
              <div><strong>Amount Paid:</strong> ₹{parseFloat(purchaseSuccess.final_amount).toLocaleString("en-IN")}</div>
            </div>

            <button
              onClick={() => setPurchaseSuccess(null)}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-all"
            >
              Done / Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
