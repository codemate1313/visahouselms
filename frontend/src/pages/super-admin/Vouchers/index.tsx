import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/api/client";
import { confirmDelete } from "@/components/confirmDialog";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Badge, Button, DataTableCard, FilterBar, Modal, SearchInput, SearchableSelect, SegmentedControl, Input, Textarea } from "@/components/ui";
import { IconButton } from "@/components/ui/IconButton/IconButton";
import type { BadgeTone } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { RowActionMenu } from "@/components/RowActionMenu";
import { useToastStore } from "@/store/toastStore";
import { vouchersStrings as s } from "./Vouchers.strings";
import "@/styles/voucher-ui.css";
import "./Vouchers.css";
import { formatDate } from "@/utils/date";
import { formatCurrencyAmount } from "@/utils/currency";
import { PurchaseDetailsModal } from "./components/PurchaseDetailsModal";

interface VoucherType {
  id: number;
  name: string;
  code: string;
  description?: string;
  badge_color: string;
  is_active: boolean;
  stock: {
    total: number;
    available: number;
    purchased: number;
    disabled: number;
  };
}

interface VoucherOffering {
  id: number;
  voucher_type_id: number;
  voucher_type_name: string;
  voucher_type_code: string;
  voucher_type_badge_color: string;
  title: string;
  description?: string;
  price: string;
  discount_price?: string;
  validity_days: number;
  gst_rate_id?: number;
  gst_percentage: string;
  image_url?: string | null;
  is_active: boolean;
  available_stock: number;
}

interface VoucherPurchase {
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

interface UnusedVoucherCode {
  id: number;
  code: string;
  status: "available" | "disabled";
  voucher_type_name: string;
  voucher_type_badge_color: string;
  validity_days: number;
  source_filename: string;
  created_at: string;
  voucher_type_id: number;
}

interface GstRate {
  id: number;
  name: string;
  percentage: number;
}

const PAGE_SIZE = 25;

const COLOR_PRESETS = [
  "#0284c7", // Sky Blue
  "#7c3aed", // Royal Purple
  "#059669", // Emerald Green
  "#d97706", // Amber
  "#dc2626", // Red / Crimson
  "#2563eb", // Deep Blue
  "#4f46e5", // Indigo
  "#1e293b", // Slate / Dark
];

const PURCHASE_STATUS_OPTIONS = [
  { value: "all", label: "All payment statuses" },
  { value: "completed", label: "Paid" },
  { value: "pending", label: "Awaiting payment" },
  { value: "failed", label: "Failed" },
];

/** A purchase is only a sale once its payment was verified. Pending rows are
 * checkout attempts holding a reserved code, and failed ones released it. */
function purchaseStatusTone(status: string): BadgeTone {
  if (status === "completed") return "success";
  if (status === "pending") return "warning";
  if (status === "refunded") return "info";
  return "danger";
}

function purchaseStatusLabel(status: string): string {
  if (status === "completed") return "Paid";
  if (status === "pending") return "Awaiting payment";
  if (status === "failed") return "Failed";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function Vouchers() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);
  const [activeTab, setActiveTab] = useState<"purchases" | "unused" | "upload" | "offerings" | "types">("purchases");
  const [types, setTypes] = useState<VoucherType[]>([]);
  const [offerings, setOfferings] = useState<VoucherOffering[]>([]);
  const [purchases, setPurchases] = useState<VoucherPurchase[]>([]);
  const [unusedCodes, setUnusedCodes] = useState<UnusedVoucherCode[]>([]);
  const [gstRates, setGstRates] = useState<GstRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [unusedSearch, setUnusedSearch] = useState("");
  const [unusedTypeFilter, setUnusedTypeFilter] = useState("all");
  const [purchasesPage, setPurchasesPage] = useState(1);
  const [unusedPage, setUnusedPage] = useState(1);
  const [editingCode, setEditingCode] = useState<UnusedVoucherCode | null>(null);
  const [codeForm, setCodeForm] = useState({ code: "", voucher_type_id: 0 });
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [selectedUnusedIds, setSelectedUnusedIds] = useState<Set<number>>(new Set());

  // Modals & Forms State
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<VoucherType | null>(null);
  const [typeForm, setTypeForm] = useState({
    name: "",
    code: "",
    description: "",
    badge_color: "#0284c7",
    is_active: true,
  });

  const [showOfferingModal, setShowOfferingModal] = useState(false);
  const [editingOffering, setEditingOffering] = useState<VoucherOffering | null>(null);
  const [offeringForm, setOfferingForm] = useState({
    voucher_type_id: 0,
    title: "",
    description: "",
    price: "",
    discount_price: "",
    validity_days: 180,
    gst_rate_id: "",
    image_url: null as string | null,
    is_active: true,
  });

  //  // Upload / Entry States
  const [uploadTypeId, setUploadTypeId] = useState<number>(0);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  
  // Manual Entry States
  const [entryMode, setEntryMode] = useState<"file" | "manual">("file");
  const [manualCodes, setManualCodes] = useState<string>("");

  // Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<VoucherPurchase | null>(null);

  // Purchase Details Modal State
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<VoucherPurchase | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, oRes, pRes, uRes, gRes] = await Promise.all([
        api.get<VoucherType[]>("/vouchers/admin/types").catch(() => ({ data: [] })),
        api.get<VoucherOffering[]>("/vouchers/admin/offerings").catch(() => ({ data: [] })),
        api.get<VoucherPurchase[]>(`/vouchers/admin/purchases${search ? `?search=${encodeURIComponent(search)}` : ""}`).catch(() => ({ data: [] })),
        api.get<UnusedVoucherCode[]>("/vouchers/admin/codes/unused").catch(() => ({ data: [] })),
        api.get<GstRate[]>("/super-admin/gst-rates").catch(() => ({ data: [] })),
      ]);
      setTypes(Array.isArray(tRes.data) ? tRes.data : []);
      setOfferings(Array.isArray(oRes.data) ? oRes.data : []);
      setPurchases(Array.isArray(pRes.data) ? pRes.data : []);
      setUnusedCodes(Array.isArray(uRes.data) ? uRes.data : []);
      setGstRates(Array.isArray(gRes.data) ? gRes.data : []);
      setSelectedUnusedIds(new Set());

      if (tRes.data && tRes.data.length > 0 && !uploadTypeId) {
        setUploadTypeId(tRes.data[0].id);
        setOfferingForm((prev) => ({ ...prev, voucher_type_id: tRes.data[0].id }));
      }
    } catch (err) {
      console.error("Failed to load voucher data", err);
      showError("Failed to load voucher data.");
    } finally {
      setLoading(false);
    }
  }, [search, showError, uploadTypeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // A new search or filter describes a different result set, so pagination
  // restarts from page 1.
  useEffect(() => {
    setPurchasesPage(1);
  }, [search, paymentStatusFilter]);

  useEffect(() => {
    setUnusedPage(1);
  }, [unusedSearch, unusedTypeFilter]);

  // Type Modal Handlers
  function openTypeModal(vt?: VoucherType) {
    if (vt) {
      setEditingType(vt);
      setTypeForm({
        name: vt.name,
        code: vt.code,
        description: vt.description || "",
        badge_color: vt.badge_color || "#0284c7",
        is_active: vt.is_active,
      });
    } else {
      setEditingType(null);
      setTypeForm({
        name: "",
        code: "",
        description: "",
        badge_color: "#0284c7",
        is_active: true,
      });
    }
    setShowTypeModal(true);
  }



  async function handleSaveType(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingType) {
        await api.put(`/vouchers/admin/types/${editingType.id}`, typeForm);
      } else {
        await api.post("/vouchers/admin/types", typeForm);
      }
      setShowTypeModal(false);
      setActiveTab("types");
      showSuccess(editingType ? "Voucher type updated." : "Voucher type created.");
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to save voucher type");
    }
  }

  // Offering Modal Handlers
  function openOfferingModal(vo?: VoucherOffering) {
    if (vo) {
      setEditingOffering(vo);
      setOfferingForm({
        voucher_type_id: vo.voucher_type_id,
        title: vo.title,
        description: vo.description || "",
        price: vo.price ? String(Number(vo.price)) : "",
        discount_price: vo.discount_price ? String(Number(vo.discount_price)) : "",
        validity_days: vo.validity_days,
        gst_rate_id: vo.gst_rate_id ? String(vo.gst_rate_id) : "",
        image_url: vo.image_url || null,
        is_active: vo.is_active,
      });
    } else {
      setEditingOffering(null);
      setOfferingForm({
        voucher_type_id: types.length > 0 ? types[0].id : 0,
        title: "",
        description: "",
        price: "",
        discount_price: "",
        validity_days: 180,
        gst_rate_id: "",
        image_url: null,
        is_active: true,
      });
    }
    setShowOfferingModal(true);
  }

  async function handleSaveOffering(e: React.FormEvent) {
    e.preventDefault();
    if (
      offeringForm.discount_price &&
      Number(offeringForm.discount_price) >= Number(offeringForm.price)
    ) {
      showError("Discount price must be less than the regular price.");
      return;
    }
    try {
      const payload = {
        voucher_type_id: Number(offeringForm.voucher_type_id),
        title: offeringForm.title,
        description: offeringForm.description || null,
        price: Number(offeringForm.price),
        discount_price: offeringForm.discount_price ? Number(offeringForm.discount_price) : null,
        validity_days: Number(offeringForm.validity_days),
        gst_rate_id: offeringForm.gst_rate_id ? Number(offeringForm.gst_rate_id) : null,
        image_url: offeringForm.image_url,
        is_active: offeringForm.is_active,
      };

      if (editingOffering) {
        await api.put(`/vouchers/admin/offerings/${editingOffering.id}`, payload);
      } else {
        await api.post("/vouchers/admin/offerings", payload);
      }
      setShowOfferingModal(false);
      setActiveTab("offerings");
      showSuccess(editingOffering ? "Voucher offering updated." : "Voucher offering created.");
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to save offering");
    }
  }

  async function handleOfferingImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/vouchers/admin/offerings/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setOfferingForm({ ...offeringForm, image_url: res.data.url });
      showSuccess("Image uploaded successfully.");
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  // Bulk Upload / Manual Entry Handler
  async function handleBulkUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadTypeId) {
      showError("Please select a voucher type");
      return;
    }

    setUploading(true);
    setUploadResult(null);
    try {
      if (entryMode === "file") {
        if (!uploadFile) {
          showError("Please select a file to upload");
          setUploading(false);
          return;
        }
        const formData = new FormData();
        formData.append("voucher_type_id", String(uploadTypeId));
        formData.append("file", uploadFile);
  
        const res = await api.post("/vouchers/admin/bulk-upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUploadResult(res.data);
      } else {
        if (!manualCodes.trim()) {
          showError("Please enter at least one voucher code");
          setUploading(false);
          return;
        }
        // Split by newline or comma
        const codes = manualCodes.split(/[\n,]+/).map(c => c.trim()).filter(c => c.length > 0);
        const res = await api.post("/vouchers/admin/codes/manual", {
          voucher_type_id: uploadTypeId,
          codes: codes
        });
        setUploadResult(res.data);
        setManualCodes(""); // Clear after success
      }
      showSuccess("Voucher codes processed.");
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Code upload/entry failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteOffering(id: number, title: string) {
    if (!await confirmDelete(`Delete offering "${title}"?`, "Delete Voucher Offering")) return;
    try {
      await api.delete(`/vouchers/admin/offerings/${id}`);
      showSuccess("Voucher offering deleted.");
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to delete offering");
    }
  }

  async function handleDeleteType(id: number, name: string) {
    if (!await confirmDelete(`Delete voucher type "${name}"? This will also remove associated codes and offerings.`, "Delete Voucher Type")) return;
    try {
      await api.delete(`/vouchers/admin/types/${id}`);
      showSuccess("Voucher type deleted.");
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to delete voucher type");
    }
  }

  function toggleUnusedCodeSelection(id: number, checked: boolean) {
    setSelectedUnusedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function toggleAllVisibleUnusedCodes(checked: boolean) {
    setSelectedUnusedIds((current) => {
      const next = new Set(current);
      filteredUnusedIds.forEach((id) => {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      });
      return next;
    });
  }

  // --- Unused Codes Actions ---
  function openEditCodeModal(code: UnusedVoucherCode) {
    setEditingCode(code);
    setCodeForm({ code: code.code, voucher_type_id: code.voucher_type_id });
    setShowCodeModal(true);
  }

  async function handleSaveCode(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCode) return;
    try {
      await api.put(`/vouchers/admin/codes/${editingCode.id}`, codeForm);
      showSuccess("Voucher code updated successfully");
      setShowCodeModal(false);
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to update voucher code");
    }
  }

  async function handleToggleCode(id: number, code: string, currentStatus: "available" | "disabled") {
    const isDisabling = currentStatus === "available";
    if (
      !(await confirmDelete(
        isDisabling
          ? `Disable voucher code "${code}"? It will no longer be sold to students.`
          : `Re-enable voucher code "${code}"? It will become available for sale again.`,
        isDisabling ? "Disable Voucher Code" : "Enable Voucher Code",
      ))
    )
      return;
    try {
      await api.patch(`/vouchers/admin/codes/${id}/toggle`);
      showSuccess(`Code ${code} status toggled`);
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to toggle code");
    }
  }

  async function handleDeleteCode(id: number, code: string) {
    if (!await confirmDelete(`Permanently delete voucher code "${code}"? This cannot be undone.`, "Delete Voucher Code")) return;
    try {
      await api.delete(`/vouchers/admin/codes/${id}`);
      showSuccess("Voucher code deleted.");
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to delete voucher code");
    }
  }

  async function handleDisableSelectedCodes() {
    const codeIds = availableFilteredUnusedIds.filter((id) => selectedUnusedIds.has(id));
    if (codeIds.length === 0) return;
    if (!await confirmDelete(`Disable ${codeIds.length} selected voucher code${codeIds.length === 1 ? "" : "s"}? They will no longer be sold to students.`, "Disable Selected Voucher Codes")) return;
    try {
      const res = await api.post("/vouchers/admin/codes/disable", { code_ids: codeIds });
      showSuccess(res.data?.message || "Selected voucher codes disabled.");
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to disable selected voucher codes");
    }
  }

  async function handleDeleteSelectedCodes() {
    const codeIds = filteredUnusedIds.filter((id) => selectedUnusedIds.has(id));
    if (codeIds.length === 0) return;
    if (!await confirmDelete(`Permanently delete ${codeIds.length} selected voucher code${codeIds.length === 1 ? "" : "s"}? This cannot be undone.`, "Delete Selected Voucher Codes")) return;
    try {
      const res = await api.post("/vouchers/admin/codes/delete", { code_ids: codeIds });
      showSuccess(res.data?.message || "Selected voucher codes deleted.");
      fetchData();
    } catch (err: any) {
      showError(err.response?.data?.detail || "Failed to delete selected voucher codes");
    }
  }

  // KPI Metrics Calculation
  const totalAvailableStock = types.reduce((acc, t) => acc + (t.stock?.available || 0), 0);
  const paidPurchases = purchases.filter((purchase) => purchase.status === "completed");
  const totalPurchasedCount = paidPurchases.length;
  const totalRevenue = paidPurchases.reduce((acc, p) => acc + (parseFloat(p.final_amount) || 0), 0);

  // Dropdown Options
  const typeSelectOptions = types.map((t) => ({
    value: String(t.id),
    label: `${t.name} (Available Stock: ${t.stock?.available || 0})`,
  }));

  const gstSelectOptions = [
    { value: "", label: "No GST (0%)" },
    ...gstRates.map((g) => ({
      value: String(g.id),
      label: `${g.name} (${g.percentage}%)`,
    })),
  ];
  const unusedTypeOptions = [
    { value: "all", label: "All voucher types" },
    ...types.map((t) => ({ value: t.name, label: t.name })),
  ];
  const filteredPurchases = useMemo(
    () =>
      purchases.filter(
        (purchase) => paymentStatusFilter === "all" || purchase.status === paymentStatusFilter
      ),
    [purchases, paymentStatusFilter]
  );
  const filteredUnusedCodes = useMemo(() => {
    const query = unusedSearch.trim().toLowerCase();
    return unusedCodes.filter((code) => {
      const matchesType = unusedTypeFilter === "all" || code.voucher_type_name === unusedTypeFilter;
      const matchesSearch =
        !query ||
        code.code.toLowerCase().includes(query) ||
        code.voucher_type_name.toLowerCase().includes(query) ||
        (code.source_filename || "").toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
  }, [unusedCodes, unusedSearch, unusedTypeFilter]);
  const filteredUnusedIds = useMemo(
    () => filteredUnusedCodes.map((code) => code.id),
    [filteredUnusedCodes]
  );
  const availableFilteredUnusedIds = useMemo(
    () => filteredUnusedCodes.filter((code) => code.status === "available").map((code) => code.id),
    [filteredUnusedCodes]
  );
  const allVisibleUnusedSelected =
    filteredUnusedIds.length > 0 && filteredUnusedIds.every((id) => selectedUnusedIds.has(id));
  const selectedVisibleUnusedCount = filteredUnusedIds.filter((id) => selectedUnusedIds.has(id)).length;
  const selectedAvailableUnusedCount = availableFilteredUnusedIds.filter((id) => selectedUnusedIds.has(id)).length;

  const purchasesTotalPages = Math.max(1, Math.ceil(filteredPurchases.length / PAGE_SIZE));
  const pagedPurchases = filteredPurchases.slice((purchasesPage - 1) * PAGE_SIZE, purchasesPage * PAGE_SIZE);
  const unusedTotalPages = Math.max(1, Math.ceil(filteredUnusedCodes.length / PAGE_SIZE));
  const pagedUnusedCodes = filteredUnusedCodes.slice((unusedPage - 1) * PAGE_SIZE, unusedPage * PAGE_SIZE);

  return (
    <div className="vouchers-page-wrapper voucher-ui-scope">
      {/* KPI Metric Cards */}
      <div className="vouchers-metric-row">
        <MetricCard
          label="Available Stock"
          value={totalAvailableStock}
          valueFormatter={(val) => `${val} Codes`}
          icon="module"
          tone="emerald"
        />
        <MetricCard
          label="Purchased Vouchers"
          value={totalPurchasedCount}
          valueFormatter={(val) => `${val} Sold`}
          icon="transactions"
          tone="blue"
        />
        <MetricCard
          label="Total Voucher Revenue"
          value={formatCurrencyAmount(totalRevenue)}
          icon="revenue"
          tone="purple"
        />
      </div>

      {/* Section Tabs */}
      <div>
          <SegmentedControl
            value={activeTab}
            onChange={setActiveTab as (v: string) => void}
            options={[
              { value: "purchases", label: s.tabs.purchases, icon: <Icon name="grading" /> },
              { value: "unused", label: "Unused Codes", icon: <Icon name="module" /> },
              { value: "upload", label: s.tabs.upload, icon: <Icon name="plus" /> },
              { value: "offerings", label: s.tabs.offerings, icon: <Icon name="module" /> },
              { value: "types", label: s.tabs.types, icon: <Icon name="admin" /> },
            ]}
          />
      </div>

      {/* Action Toolbar & Filters */}
      {(activeTab === "purchases" || activeTab === "unused" || activeTab === "types" || activeTab === "offerings") && (
        <FilterBar
          resultCount={
            <>
              Showing <strong>
                {activeTab === "purchases"
                  ? filteredPurchases.length
                  : activeTab === "unused"
                  ? filteredUnusedCodes.length
                  : activeTab === "offerings"
                  ? offerings.length
                  : types.length}
              </strong> records
            </>
          }
        >
          {activeTab === "purchases" && (
            <>
              <SearchInput
                placeholder={s.purchases.searchPlaceholder}
                value={search}
                onChange={(val) => setSearch(val)}
                width={320}
              />
              <SearchableSelect
                options={PURCHASE_STATUS_OPTIONS}
                value={paymentStatusFilter}
                onChange={(val) => setPaymentStatusFilter(String(val))}
                placeholder="All payment statuses"
                searchable={false}
                className="status-filter-select voucher-filter-select"
              />
            </>
          )}
          {activeTab === "unused" && (
            <>
              <SearchInput
                placeholder="Search code, type, or filename"
                value={unusedSearch}
                onChange={setUnusedSearch}
                width={320}
              />
              <SearchableSelect
                options={unusedTypeOptions}
                value={unusedTypeFilter}
                onChange={(val) => setUnusedTypeFilter(String(val))}
                placeholder="All voucher types"
                searchable={false}
                className="status-filter-select voucher-filter-select"
              />
              <Button
                variant="danger"
                size="small"
                disabled={selectedAvailableUnusedCount === 0}
                onClick={handleDisableSelectedCodes}
              >
                <Icon name="revoke" /> Disable selected ({selectedAvailableUnusedCount})
              </Button>
              <Button
                variant="danger"
                size="small"
                disabled={selectedVisibleUnusedCount === 0}
                onClick={handleDeleteSelectedCodes}
              >
                <Icon name="trash" /> Delete selected ({selectedVisibleUnusedCount})
              </Button>
            </>
          )}

          <div style={{ display: "flex", gap: "1rem", marginLeft: "auto" }}>
            {activeTab === "types" && (
              <Button variant="primary" size="small" onClick={() => openTypeModal()}>
                <Icon name="plus" /> {s.types.addType}
              </Button>
            )}
            {activeTab === "offerings" && (
              <Button variant="primary" size="small" onClick={() => openOfferingModal()}>
                <Icon name="plus" /> {s.offerings.addOffering}
              </Button>
            )}
          </div>
        </FilterBar>
      )}

      {/* TAB 1: STOCK & PURCHASE HISTORY */}
      {activeTab === "purchases" && (
        <DataTableCard>
          {loading ? (
            <p className="ui-loading-copy">Loading voucher purchases...</p>
          ) : (
            <table className="data-table voucher-purchases-table">
              <thead>
                <tr>
                  <th className="col-purchase-no">{s.purchases.purchaseNo}</th>
                  <th className="col-buyer">{s.purchases.buyer}</th>
                  <th className="col-voucher-info">{s.purchases.voucherInfo}</th>
                  <th className="col-payment-status">{s.purchases.paymentAndStatus}</th>
                  <th className="col-purchase-date">{s.purchases.date}</th>
                  <th className="table-actions-heading col-actions text-right">{s.purchases.actions}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="ui-empty-row">
                      {purchases.length === 0 ? s.purchases.noPurchases : "No voucher purchases match the current filters."}
                    </td>
                  </tr>
                ) : (
                  pagedPurchases.map((p) => (
                    <tr key={p.id}>
                      <td className="col-purchase-no">
                        <span className="voucher-purchase-number">
                          {p.purchase_number}
                        </span>
                      </td>
                      <td className="col-buyer">
                        <div className="voucher-cell-stack">
                          <span className="voucher-buyer-name font-bold text-slate-900 dark:text-white">
                            {p.buyer_name}
                          </span>
                          <span className="voucher-buyer-email text-xs text-slate-500">
                            {p.buyer_email}
                          </span>
                          {p.buyer_phone && (
                            <span className="voucher-buyer-phone text-xs text-slate-400 font-mono">
                              {p.buyer_phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="col-voucher-info">
                        <div className="voucher-cell-stack">
                          <div>
                            <span className="voucher-type-pill">
                              {p.voucher_type_name}
                            </span>
                          </div>
                          <span className="voucher-offering-title text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {p.offering_title}
                          </span>
                        </div>
                      </td>
                      <td className="col-payment-status">
                        <div className="voucher-cell-stack">
                          <div>
                            <Badge tone={purchaseStatusTone(p.status)} className="voucher-status-pill">
                              {purchaseStatusLabel(p.status)}
                            </Badge>
                          </div>
                          <div className="voucher-amount-row flex items-center gap-1.5 mt-0.5">
                            {p.status === "completed" ? (
                              <strong className="text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                {formatCurrencyAmount(p.final_amount)}
                              </strong>
                            ) : (
                              <span className="text-xs font-semibold text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                                Not paid
                              </span>
                            )}
                            <span className="voucher-gateway-tag">· {p.gateway}</span>
                          </div>
                        </div>
                      </td>
                      <td className="col-purchase-date">
                        <span className="text-xs text-slate-500 whitespace-nowrap font-medium">
                          {formatDate(p.created_at)}
                        </span>
                      </td>
                      <td className="col-actions text-right">
                        <div className="voucher-table-actions">
                          <IconButton
                            className="voucher-action-btn btn-view"
                            label="View Full Purchase Details"
                            onClick={() => setSelectedPurchaseDetails(p)}
                            icon={<Icon name="eye" style={{ width: 17, height: 17, stroke: "currentColor" }} />}
                          />
                          {p.status === "completed" && (
                            <IconButton
                              className="voucher-action-btn btn-invoice"
                              label="View Tax Invoice"
                              onClick={() => setSelectedInvoice(p)}
                              icon={<Icon name="filePdf" style={{ width: 16, height: 16, stroke: "currentColor" }} />}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
          {purchasesTotalPages > 1 && (
            <div className="pagination">
              <Button type="button" variant="secondary" disabled={purchasesPage <= 1} onClick={() => setPurchasesPage(purchasesPage - 1)}>
                <Icon name="arrowLeft" /> Previous
              </Button>
              <span>
                Page {purchasesPage} of {purchasesTotalPages} ({filteredPurchases.length} total)
              </span>
              <Button
                type="button"
                variant="secondary"
                disabled={purchasesPage >= purchasesTotalPages}
                onClick={() => setPurchasesPage(purchasesPage + 1)}
              >
                Next <Icon name="arrowRight" />
              </Button>
            </div>
          )}
        </DataTableCard>
      )}

      {/* TAB: UNUSED CODES */}
      {activeTab === "unused" && (
        <DataTableCard>
          <table className="data-table">
            <thead>
              <tr>
                <th className="voucher-select-col">
                  <input
                    type="checkbox"
                    className="voucher-code-checkbox"
                    aria-label="Select all visible unused voucher codes"
                    checked={allVisibleUnusedSelected}
                    disabled={filteredUnusedIds.length === 0}
                    onChange={(event) => toggleAllVisibleUnusedCodes(event.target.checked)}
                  />
                </th>
                <th>Voucher Code</th>
                <th>Voucher Type</th>
                <th>Status</th>
                <th>Validity & Expiry</th>
                <th>Source & Date Added</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnusedCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="ui-empty-row">
                    {unusedCodes.length === 0 ? "No unused codes available." : "No unused codes match the current filters."}
                  </td>
                </tr>
              ) : (
                pagedUnusedCodes.map((uc) => (
                  <tr key={uc.id}>
                    <td className="voucher-select-col">
                      <input
                        type="checkbox"
                        className="voucher-code-checkbox"
                        aria-label={`Select voucher code ${uc.code}`}
                        checked={selectedUnusedIds.has(uc.id)}
                        onChange={(event) => toggleUnusedCodeSelection(uc.id, event.target.checked)}
                      />
                    </td>
                    <td>
                      <code className="voucher-code-pill">{uc.code}</code>
                    </td>
                    <td>
                      <span className="voucher-type-pill">
                        {uc.voucher_type_name}
                      </span>
                    </td>
                    <td>
                      <span className={`voucher-code-status ${uc.status === "disabled" ? "is-disabled" : "is-available"}`}>
                        {uc.status === "disabled" ? "Disabled" : "Available"}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {uc.validity_days || 180} Days
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          Exp: {formatDate(new Date(uc.created_at).getTime() + (uc.validity_days || 180) * 24 * 60 * 60 * 1000)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {uc.source_filename}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDate(uc.created_at)}
                        </span>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="voucher-code-actions flex items-center gap-3">
                        <ToggleSwitch
                          checked={uc.status === "available"}
                          onChange={() => handleToggleCode(uc.id, uc.code, uc.status)}
                          tooltip={uc.status === "available" ? "Deactivate" : "Activate"}
                        />
                        <IconButton
                          label="Edit Voucher Code"
                          aria-label={`Edit voucher code ${uc.code}`}
                          onClick={() => openEditCodeModal(uc)}
                          className="action-btn-icon action-edit"
                          style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
                          icon={<Icon name="edit" />}
                        />
                        <RowActionMenu
                          items={[
                            <Button
                              key="delete"
                              type="button"
                              variant="text"
                              className="action-menu-item text-red-600"
                              onClick={() => handleDeleteCode(uc.id, uc.code)}
                            >
                              <Icon name="trash" className="w-4 h-4 mr-2" /> Delete Code
                            </Button>
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {unusedTotalPages > 1 && (
            <div className="pagination">
              <Button type="button" variant="secondary" disabled={unusedPage <= 1} onClick={() => setUnusedPage(unusedPage - 1)}>
                <Icon name="arrowLeft" /> Previous
              </Button>
              <span>
                Page {unusedPage} of {unusedTotalPages} ({filteredUnusedCodes.length} total)
              </span>
              <Button type="button" variant="secondary" disabled={unusedPage >= unusedTotalPages} onClick={() => setUnusedPage(unusedPage + 1)}>
                Next <Icon name="arrowRight" />
              </Button>
            </div>
          )}
        </DataTableCard>
      )}

      {/* TAB 2: BULK CODE UPLOAD / MANUAL ENTRY */}
      {activeTab === "upload" && (
        <div className="vouchers-upload-container">
          <div className="mb-6 text-left">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Import Voucher Codes</h3>
            <p className="text-sm text-slate-500 mt-1">Add new inventory by uploading a file or entering codes manually.</p>
          </div>

          <form onSubmit={handleBulkUpload} className="space-y-5">
            <div className="form-field-group">
              <label>{s.upload.selectType}</label>
              <SearchableSelect
                options={typeSelectOptions}
                value={String(uploadTypeId)}
                onChange={(val) => setUploadTypeId(Number(val))}
                placeholder="Select Voucher Type"
                searchable={false}
              />
            </div>

            <div className="pt-1">
              <SegmentedControl
                value={entryMode}
                onChange={(val) => setEntryMode(val as "file" | "manual")}
                options={[
                  { value: "file", label: "File Upload", icon: <Icon name="plus" /> },
                  { value: "manual", label: "Manual Entry", icon: <Icon name="edit" /> },
                ]}
              />
            </div>

            <div className="pt-2">
              {entryMode === "file" ? (
                <div className="upload-drop-area" style={{ position: "relative", overflow: "hidden" }}>
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.docx,.txt"
                    onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", zIndex: 10 }}
                    required
                  />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", pointerEvents: "none" }}>
                    <div style={{ width: "50px", height: "50px", borderRadius: "16px", backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--text)" }}>
                        {uploadFile ? uploadFile.name : "Click or drag & drop file"}
                      </div>
                      <div style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        Supports PDF, Excel, Word, and Text files
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="form-field-group">
                  <Textarea
                    placeholder="Paste codes here. Separate with commas or new lines."
                    value={manualCodes}
                    onChange={(e) => setManualCodes(e.target.value)}
                    rows={5}
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5 font-medium">
                    Make sure each code is exactly 16 alphanumeric characters. Invalid codes will be skipped.
                  </p>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              type="submit"
              disabled={uploading || (entryMode === "file" && !uploadFile) || (entryMode === "manual" && !manualCodes)}
              className="w-full py-3 mt-2"
            >
              {uploading ? "Processing..." : entryMode === "file" ? "Import File" : "Import Codes"}
            </Button>
          </form>

          {uploadResult && (
            <div className={`upload-result-banner ${uploadResult.inserted > 0 ? "success" : "error"}`}>
              <div className="result-title">{uploadResult.message}</div>
              <div className="result-stats">
                <span><strong>{uploadResult.total_extracted}</strong> Extracted</span>
                <span className="dot">•</span>
                <span><strong>{uploadResult.inserted}</strong> Inserted</span>
                <span className="dot">•</span>
                <span><strong>{uploadResult.duplicates_skipped}</strong> Skipped</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OFFERINGS & PRICING (BEAUTIFUL ULTRA-PREMIUM CARDS) */}
      {activeTab === "offerings" && (
        <div className="vouchers-grid">
          {offerings.length === 0 ? (
            <div className="col-span-full p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/60 my-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center text-slate-400 mb-3">
                <Icon name="plus" />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">No Voucher Offerings Found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">Create a pricing offering package to sell voucher codes to students.</p>
              <Button variant="primary" size="small" onClick={() => openOfferingModal()}>
                + Create Voucher Offering
              </Button>
            </div>
          ) : (
            offerings.map((vo) => (
            <div 
              key={vo.id} 
              className="voucher-premium-card"
              style={{ "--accent-color": vo.voucher_type_badge_color || "#0284c7" } as React.CSSProperties}
            >
              <div className="voucher-card-body">
                {/* Header Row */}
                <div className="voucher-card-top-row">
                  <span className="voucher-type-badge glass-badge" title={vo.voucher_type_name}>
                    {vo.voucher_type_name}
                  </span>
                  <div className={`status-indicator ${vo.is_active ? "active" : "inactive"}`}>
                    <span className="status-dot"></span>
                    {vo.is_active ? "Active" : "Inactive"}
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug">{vo.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[32px] leading-relaxed">
                    {vo.description || "No description provided for this offering package."}
                  </p>
                </div>

                {/* Price Box */}
                <div className="voucher-price-callout-box">
                  <div className="voucher-price-amount-row">
                    <span className="voucher-price-main-text">
                      {formatCurrencyAmount(vo.discount_price || vo.price)}
                    </span>
                    {vo.discount_price && (
                      <span className="voucher-price-original-text">{formatCurrencyAmount(vo.price)}</span>
                    )}
                  </div>
                  <div className="voucher-meta-info-row">
                    <span>Validity: <strong>{vo.validity_days} Days</strong></span>
                    <span className="meta-dot-divider" />
                    <span>GST Tax: <strong>{vo.gst_percentage}%</strong></span>
                  </div>
                </div>

                {/* Stock Bar */}
                <div className="voucher-stock-status-box">
                  <div className="stock-status-label">
                    <Icon name="module" />
                    <span>Available Stock:</span>
                  </div>
                  <span className={`stock-bubble-badge ${vo.available_stock > 0 ? "in-stock" : "no-stock"}`}>
                    {vo.available_stock > 0 ? `${vo.available_stock} Available` : "Out of Stock"}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="voucher-card-footer">
                <span className="text-xs font-semibold text-slate-400">Ref: OFF-{vo.id}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => openOfferingModal(vo)}
                    leftIcon={<Icon name="edit" className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteOffering(vo.id, vo.title)}
                    leftIcon={<Icon name="trash" className="w-3.5 h-3.5" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      )}

      {/* TAB 4: VOUCHER MASTER / TYPES (BEAUTIFUL ULTRA-PREMIUM CARDS) */}
      {activeTab === "types" && (
        <div className="vouchers-grid">
          {types.length === 0 ? (
            <div className="col-span-full p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/60 my-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 mx-auto flex items-center justify-center text-slate-400 mb-3">
                <Icon name="plus" />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">No Voucher Types Found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">Create a master voucher type (e.g. LanguageCert Academic, Duolingo, PTE) to start uploading codes.</p>
              <Button variant="primary" size="small" onClick={() => openTypeModal()}>
                + Add Voucher Type
              </Button>
            </div>
          ) : (
            types.map((vt) => (
            <div 
              key={vt.id} 
              className="voucher-premium-card"
              style={{ "--accent-color": vt.badge_color || "#0284c7" } as React.CSSProperties}
            >
              <div className="voucher-card-body">
                {/* Header Row */}
                <div className="voucher-card-top-row">
                  <span className="voucher-type-badge glass-badge" title={vt.name}>
                    {vt.name}
                  </span>
                  <div className={`status-indicator ${vt.is_active ? "active" : "inactive"}`}>
                    <span className="status-dot"></span>
                    {vt.is_active ? "Active" : "Inactive"}
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[32px] leading-relaxed">
                  {vt.description || "Master voucher category for managing inventory."}
                </p>

                {/* Stock Breakdown Grid */}
                <div className="voucher-type-stock-grid">
                  <div className="stock-stat-bubble">
                    <span className="label">Available</span>
                    <span className="value text-emerald-600">{vt.stock?.available || 0}</span>
                  </div>
                  <div className="stock-stat-bubble">
                    <span className="label">Purchased</span>
                    <span className="value text-sky-600">{vt.stock?.purchased || 0}</span>
                  </div>
                  <div className="stock-stat-bubble">
                    <span className="label">Total</span>
                    <span className="value">{vt.stock?.total || 0}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="voucher-card-footer">
                <span className="text-xs font-semibold text-slate-400">Type ID: {vt.id}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => openTypeModal(vt)}
                    leftIcon={<Icon name="edit" className="w-3.5 h-3.5" />}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeleteType(vt.id, vt.name)}
                    leftIcon={<Icon name="trash" className="w-3.5 h-3.5" />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
        </div>
      )}

      {/* CREATE / EDIT TYPE MODAL */}
      <Modal
        open={showTypeModal}
        onClose={() => setShowTypeModal(false)}
        title={editingType ? s.types.editType : s.types.addType}
      >
        <form onSubmit={handleSaveType} style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingTop: "0.25rem" }}>
          {/* 2-Column Row for Name and Code */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", width: "100%" }}>
            <div className="form-field-group">
              <Input
                label={s.types.typeName}
                required
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                placeholder="e.g. LanguageCert Academic"
              />
            </div>

            <div className="form-field-group">
              <Input
                label={s.types.typeCode}
                required
                disabled={!!editingType}
                value={typeForm.code}
                onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
                placeholder="e.g. languagecert-academic"
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-field-group">
            <Textarea
              label={s.types.description}
              value={typeForm.description}
              onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
              placeholder="Brief description of this voucher type..."
              rows={2}
            />
          </div>

          {/* Badge Color Box */}
          <div style={{ backgroundColor: "var(--surface-muted, #f8fafc)", padding: "0.85rem 1rem", borderRadius: "12px", border: "1px solid var(--border-subtle, var(--slate-200))" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted, var(--slate-500))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
              {s.types.badgeColor}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setTypeForm({ ...typeForm, badge_color: color })}
                  style={{
                    backgroundColor: color,
                    width: "32px",
                    height: "32px",
                    minWidth: "32px",
                    minHeight: "32px",
                    borderRadius: "9999px",
                    border: typeForm.badge_color === color ? "2px solid var(--slate-900)" : "2px solid transparent",
                    boxShadow: typeForm.badge_color === color ? "0 0 0 3px rgba(2, 132, 199, 0.35)" : "0 1px 3px rgba(0,0,0,0.12)",
                    cursor: "pointer",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "transform 0.15s ease",
                    transform: typeForm.badge_color === color ? "scale(1.1)" : "scale(1)",
                  }}
                  title={color}
                >
                  {typeForm.badge_color === color && (
                    <Icon name="check" className="w-4 h-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem", paddingTop: "0.85rem", borderTop: "1px solid var(--border-subtle, var(--slate-200))" }}>
            <Button variant="secondary" type="button" onClick={() => setShowTypeModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Type
            </Button>
          </div>
        </form>
      </Modal>

      {/* CREATE / EDIT OFFERING MODAL */}
      <Modal
        open={showOfferingModal}
        onClose={() => setShowOfferingModal(false)}
        title={editingOffering ? s.offerings.editOffering : s.offerings.addOffering}
        size="lg"
      >
        <form onSubmit={handleSaveOffering} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Column: Voucher Type, Title & Description */}
            <div className="space-y-3.5">
              <div className="form-field-group">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">{s.offerings.selectType}</label>
                <SearchableSelect
                  options={typeSelectOptions}
                  value={String(offeringForm.voucher_type_id)}
                  onChange={(val) => setOfferingForm({ ...offeringForm, voucher_type_id: Number(val) })}
                  placeholder="Select Voucher Type"
                  searchable={false}
                />
              </div>

              <Input
                label={s.offerings.title}
                required
                value={offeringForm.title}
                onChange={(e) => setOfferingForm({ ...offeringForm, title: e.target.value })}
                placeholder="e.g. LanguageCert Academic Standard Exam Voucher"
              />

              <Textarea
                label="Offering Description"
                value={offeringForm.description}
                onChange={(e) => setOfferingForm({ ...offeringForm, description: e.target.value })}
                placeholder="Package details and redemption instructions..."
                rows={3}
              />
            </div>

            {/* Right Column: Pricing, Validity & GST */}
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={s.offerings.price}
                  type="number"
                  min="0"
                  required
                  value={offeringForm.price}
                  onChange={(e) => setOfferingForm({ ...offeringForm, price: e.target.value })}
                />

                <Input
                  label={s.offerings.discountPrice}
                  type="number"
                  min="0"
                  value={offeringForm.discount_price}
                  onChange={(e) => setOfferingForm({ ...offeringForm, discount_price: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={s.offerings.validityDays}
                  type="number"
                  required
                  value={offeringForm.validity_days}
                  onChange={(e) => setOfferingForm({ ...offeringForm, validity_days: Number(e.target.value) })}
                />

                <div className="form-field-group">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">{s.offerings.gstRate}</label>
                  <SearchableSelect
                    options={gstSelectOptions}
                    value={offeringForm.gst_rate_id}
                    onChange={(val) => setOfferingForm({ ...offeringForm, gst_rate_id: String(val) })}
                    placeholder="Select GST Rate"
                    searchable={false}
                  />
                </div>
              </div>

              {/* Image Upload */}
              <div className="form-field-group">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Offering Image (Optional)</label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="w-16 h-16 rounded overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 flex-shrink-0">
                    {offeringForm.image_url ? (
                      <img src={offeringForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl text-slate-400">🖼️</span>
                    )}
                  </div>
                  <div>
                    <label htmlFor="offering-image-upload" className="btn btn-secondary text-sm px-3 py-1.5 cursor-pointer">
                      {uploading ? "Uploading..." : "Upload Image"}
                    </label>
                    <input
                      id="offering-image-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleOfferingImageUpload}
                      disabled={uploading}
                      hidden
                    />
                    <p className="text-xs text-slate-500 mt-1.5">Recommended: 800x600px (JPG/PNG)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-5 border-t border-slate-200 dark:border-slate-800" style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.75rem", width: "100%" }}>
            <Button variant="secondary" type="button" onClick={() => setShowOfferingModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Save Offering
            </Button>
          </div>
        </form>
      </Modal>

      {/* TAX INVOICE PREVIEW MODAL */}
      <Modal
        open={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Voucher Tax Invoice"
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
                <span className="voucher-invoice-value">{selectedInvoice.buyer_name} ({selectedInvoice.buyer_email})</span>
              </div>
              <div className="voucher-invoice-row">
                <span className="voucher-invoice-label">Date:</span>
                <span className="voucher-invoice-value">{formatDate(selectedInvoice.created_at)}</span>
              </div>
              <div className="voucher-invoice-row">
                <span className="voucher-invoice-label">Gateway:</span>
                <span className="voucher-invoice-value">{selectedInvoice.gateway ? selectedInvoice.gateway.toUpperCase() : "N/A"}</span>
              </div>
            </div>

            <div className="voucher-invoice-code-box">
              <div className="voucher-invoice-code-title">Voucher Code</div>
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
            </div>
          </div>
        )}
      </Modal>
      {/* Edit Code Modal */}
      {showCodeModal && (
        <div className="modal-backdrop">
          <div className="modal-card modal-sm">
            <div className="modal-header">
              <h3>Edit Voucher Code</h3>
              <button type="button" className="modal-close" onClick={() => setShowCodeModal(false)}>
                <Icon name="x" />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveCode} className="space-y-4">
                <div className="form-group">
                  <label htmlFor="code_code">Voucher Code</label>
                  <input
                    id="code_code"
                    type="text"
                    required
                    value={codeForm.code}
                    onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })}
                    className="ui-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="code_type">Voucher Type</label>
                  <select
                    id="code_type"
                    required
                    value={codeForm.voucher_type_id}
                    onChange={(e) => setCodeForm({ ...codeForm, voucher_type_id: Number(e.target.value) })}
                    className="ui-input"
                  >
                    <option value={0}>Select Type...</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-actions mt-6 flex justify-end gap-3">
                  <Button variant="secondary" type="button" onClick={() => setShowCodeModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Details Modal */}
      {selectedPurchaseDetails && (
        <PurchaseDetailsModal
          purchase={selectedPurchaseDetails}
          onClose={() => setSelectedPurchaseDetails(null)}
          onViewInvoice={(p) => setSelectedInvoice(p)}
        />
      )}

    </div>
  );
}
