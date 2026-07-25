import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { ConfirmModal } from "@/components/ConfirmModal";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { confirmExport } from "@/utils/confirmExport";
import { couponsStrings as strings } from "./Coupons.strings";
import type { CouponRow } from "./types";
import { exportCouponsExcel, exportCouponsPDF } from "./exportHelpers";
import { CouponsFilterBar } from "./components/CouponsFilterBar";
import { CouponsTable } from "./components/CouponsTable";

export type { CouponRow } from "./types";

export function Coupons() {
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");

  const [deletingCoupon, setDeletingCoupon] = useState<CouponRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (scopeFilter) params.set("scope", scopeFilter);
      if (activeFilter) params.set("is_active", activeFilter);
      const { data } = await apiClient.get<CouponRow[]>(`/super-admin/coupons?${params}`);
      setCoupons(data);
      setError(null);
    } catch {
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }, [search, scopeFilter, activeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setItemCount(coupons.length);
    return () => setItemCount(null);
  }, [coupons.length, setItemCount]);

  async function toggleActive(coupon: CouponRow) {
    const action = coupon.is_active ? "deactivate" : "reactivate";
    const confirmed = await confirmAction(strings.confirm.toggle(coupon.is_active ? "deactivate" : "activate", coupon.code), {
      title: coupon.is_active ? strings.confirm.deactivateTitle : strings.confirm.activateTitle,
      confirmText: coupon.is_active ? "Deactivate" : "Activate",
      variant: coupon.is_active ? "warning" : "primary",
    });
    if (!confirmed) return;

    setError(null);
    setCoupons((current) =>
      current.map((item) => item.id === coupon.id ? { ...item, is_active: !coupon.is_active } : item)
    );
    try {
      await apiClient.post(`/super-admin/coupons/${coupon.id}/${action}`);
    } catch (err: unknown) {
      setCoupons((current) =>
        current.map((item) => item.id === coupon.id ? { ...item, is_active: coupon.is_active } : item)
      );
      setError(extractErrorMessage(err, strings.errors.toggle(action)));
    }
  }

  async function handleConfirmDelete() {
    if (!deletingCoupon) return;
    setError(null);
    setDeleteLoading(true);
    try {
      await apiClient.delete(`/super-admin/coupons/${deletingCoupon.id}`);
      setDeletingCoupon(null);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.delete));
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleExportPdf() {
    if (!await confirmExport("pdf", "coupons")) return;
    exportCouponsPDF(coupons);
  }

  async function handleExportExcel() {
    if (!await confirmExport("excel", "coupons")) return;
    exportCouponsExcel(coupons);
  }

  return (
    <div>
      <CouponsFilterBar
        search={search}
        onSearchChange={setSearch}
        scopeFilter={scopeFilter}
        onScopeFilterChange={setScopeFilter}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        resultCount={coupons.length}
      />

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p>{strings.loading}</p>
      ) : (
        <CouponsTable coupons={coupons} onToggleActive={toggleActive} onRequestDelete={setDeletingCoupon} />
      )}

      <ConfirmModal
        isOpen={Boolean(deletingCoupon)}
        title={strings.deleteModal.title}
        message={deletingCoupon ? strings.deleteModal.message(deletingCoupon.code) : ""}
        confirmText={strings.deleteModal.confirmText}
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingCoupon(null)}
      />
    </div>
  );
}
