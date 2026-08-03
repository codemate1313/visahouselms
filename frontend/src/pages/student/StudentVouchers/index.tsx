import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { Button, Modal, Badge } from "@/components/ui";
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
  const [activeTab, setActiveTab] = useState<"browse" | "my_vouchers">("my_vouchers");
  const [offerings, setOfferings] = useState<VoucherOffering[]>([]);
  const [myVouchers, setMyVouchers] = useState<StudentVoucher[]>([]);
  const [loading, setLoading] = useState(true);

  // Mask/Reveal toggles per voucher ID
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Purchasing modal state
  const [purchasing, setPurchasing] = useState(false);

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
    navigator.clipboard.writeText(code)
      .then(() => {
        setCopiedId(id);
        showSuccess("Voucher code copied.");
        setTimeout(() => setCopiedId(null), 2000);
      })
      .catch(() => showError("Could not copy voucher code."));
  }

  async function handleBuyNow(offering: VoucherOffering) {
    if (!user) return;
    setPurchasing(true);
    try {
      const buyerName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
      const res = await api.post("/vouchers/public/purchase", {
        offering_id: offering.id,
        buyer_name: buyerName,
        buyer_email: user.email,
        buyer_phone: user.phone_number || null,
        gateway: "demo",
      });
      showSuccess(`Voucher purchased successfully. Code: ${res.data.voucher_code}`);
      fetchData();
      setActiveTab("my_vouchers");
    } catch (err: any) {
      showError(err.response?.data?.detail || "Purchase failed. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  function getMaskedCode(code: string) {
    if (!code) return "••••-••••-••••-••••";
    const clean = code.replace("-", "");
    if (clean.length === 16) {
      return `••••-••••-••••-${clean.slice(12)}`;
    }
    return "••••-••••-••••-••••";
  }

  return (
    <div className="voucher-ui-scope p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2 max-w-2xl">
          <span className="px-3 py-1 bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-bold rounded-full uppercase tracking-wider">
            Exam Voucher Portal
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">Buy & Manage Test Vouchers</h1>
          <p className="text-slate-300 text-sm">
            Purchase 16-digit official exam voucher codes for IELTS, PTE, and more with instant activation.
          </p>
        </div>

        <div className="flex bg-slate-800 p-1.5 rounded-2xl border border-slate-700">
          <button
            onClick={() => setActiveTab("my_vouchers")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === "my_vouchers"
                ? "bg-sky-500 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            My Purchased Vouchers ({myVouchers.length})
          </button>
          <button
            onClick={() => setActiveTab("browse")}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
              activeTab === "browse"
                ? "bg-sky-500 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Browse Vouchers
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 font-medium">Loading vouchers...</div>
      ) : (
        <>
          {/* TAB 1: MY PURCHASED VOUCHERS */}
          {activeTab === "my_vouchers" && (
            <div className="space-y-6">
              {myVouchers.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 space-y-4 max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Vouchers Purchased Yet</h3>
                  <p className="text-xs text-slate-500">
                    You haven't bought any test vouchers yet. Browse available exam vouchers to get instant discounts.
                  </p>
                  <Button variant="primary" onClick={() => setActiveTab("browse")}>
                    Browse Vouchers Now
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {myVouchers.map((v) => {
                    const isRevealed = revealedIds[v.id];
                    return (
                      <div
                        key={v.id}
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-sm"
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <span
                              className="px-3 py-1 text-xs font-bold text-white rounded-full uppercase tracking-wider"
                              style={{ backgroundColor: v.voucher_type_badge_color || "#0284c7" }}
                            >
                              {v.voucher_type_name}
                            </span>
                            <Badge tone={v.is_expired ? "danger" : "success"}>
                              {v.is_expired ? "Expired" : "Valid / Ready"}
                            </Badge>
                          </div>

                          <div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{v.offering_title}</h3>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">Ref: {v.purchase_number}</div>
                          </div>

                          {/* 16-Digit Code Box */}
                          <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 text-center">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              16-Digit Voucher Code
                            </div>
                            <div className="font-mono font-black text-lg text-slate-900 dark:text-white tracking-widest">
                              {isRevealed ? v.voucher_code : getMaskedCode(v.voucher_code)}
                            </div>
                            <div className="flex justify-center gap-2 pt-1">
                              <Button variant="secondary" size="small" onClick={() => toggleReveal(v.id)}>
                                {isRevealed ? "Hide Code" : "Reveal Code"}
                              </Button>
                              <Button variant="secondary" size="small" onClick={() => handleCopy(v.id, v.voucher_code)}>
                                {copiedId === v.id ? "Copied" : "Copy Code"}
                              </Button>
                            </div>
                          </div>

                          <div className="text-xs space-y-1 text-slate-500 dark:text-slate-400 pt-1">
                            <div><strong>Valid Until:</strong> {v.valid_until ? formatDate(v.valid_until) : "N/A"}</div>
                            <div><strong>Amount Paid:</strong> {formatCurrencyAmount(v.final_amount)}</div>
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                          <Button variant="secondary" size="small" onClick={() => setSelectedInvoice(v)}>
                            Tax Invoice
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BROWSE VOUCHERS */}
          {activeTab === "browse" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {offerings.map((vo) => (
                <div
                  key={vo.id}
                  className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-sm"
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span
                        className="px-3 py-1 text-xs font-bold text-white rounded-full uppercase tracking-wider"
                        style={{ backgroundColor: vo.voucher_type_badge_color }}
                      >
                        {vo.voucher_type_name}
                      </span>
                      <Badge tone="info">Instant Delivery</Badge>
                    </div>

                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{vo.title}</h3>
                    {vo.description && <p className="text-xs text-slate-500 dark:text-slate-400">{vo.description}</p>}

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-900 dark:text-white">
                          {formatCurrencyAmount(vo.discount_price || vo.price)}
                        </span>
                        {vo.discount_price && (
                          <span className="text-xs text-slate-400 line-through">{formatCurrencyAmount(vo.price)}</span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-slate-400 mt-1">
                        Validity: {vo.validity_days} Days | 16-Digit Code
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4">
                    <Button
                      variant="primary"
                      onClick={() => handleBuyNow(vo)}
                      disabled={purchasing || vo.available_stock <= 0}
                      className="w-full"
                    >
                      {vo.available_stock > 0 ? "Buy Voucher Now" : "Out of Stock"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* STUDENT TAX INVOICE MODAL */}
      <Modal
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Voucher Tax Invoice"
      >
        {selectedInvoice && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
              <div><strong>Billed To:</strong> {selectedInvoice.buyer_name} ({selectedInvoice.buyer_email})</div>
              <div><strong>Date:</strong> {formatDate(selectedInvoice.created_at)}</div>
              <div><strong>Gateway:</strong> {selectedInvoice.gateway.toUpperCase()}</div>
            </div>

            <div className="p-4 bg-sky-50 dark:bg-sky-950/40 rounded-xl text-center">
              <div className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase">Voucher Code</div>
              <div className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">{selectedInvoice.voucher_code}</div>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">Voucher Type:</span>
              <span className="font-bold">{selectedInvoice.voucher_type_name}</span>
            </div>
            <div className="flex justify-between py-1 text-sm font-bold">
              <span>Total Paid:</span>
              <span>{formatCurrencyAmount(selectedInvoice.final_amount)}</span>
            </div>

            <div className="flex justify-end pt-2">
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
