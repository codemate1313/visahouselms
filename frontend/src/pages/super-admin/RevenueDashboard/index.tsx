import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { confirmExport } from "@/utils/confirmExport";
import { revenueDashboardStrings as strings } from "./RevenueDashboard.strings";
import type { InstituteRow, MethodRow, Summary } from "./types";
import { exportRevenueExcel, exportRevenuePDF } from "./exportHelpers";
import { RevenueFilterBar } from "./components/RevenueFilterBar";
import { RevenueKpiRow } from "./components/RevenueKpiRow";
import { RevenueCharts } from "./components/RevenueCharts";
import { OutstandingDuesPanel } from "./components/OutstandingDuesPanel";

export function RevenueDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [institutes, setInstitutes] = useState<InstituteRow[]>([]);
  const [methods, setMethods] = useState<MethodRow[]>([]);

  const [instituteFilter, setInstituteFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (instituteFilter) params.set("institute_id", instituteFilter);
      if (methodFilter) params.set("payment_method_id", methodFilter);
      if (dateFrom) params.set("date_from", `${dateFrom}T00:00:00`);
      if (dateTo) params.set("date_to", `${dateTo}T23:59:59`);
      const { data } = await apiClient.get<Summary>(`/super-admin/revenue/summary?${params}`);
      setSummary(data);
      setError(null);
    } catch {
      setError(strings.errors.load);
    }
  }, [instituteFilter, methodFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiClient.get("/super-admin/institutes").then(({ data }) => setInstitutes(data));
    apiClient
      .get<MethodRow[]>("/super-admin/payment-methods", { params: { active_only: true } })
      .then(({ data }) => setMethods(data));
  }, []);

  async function handleExportPdf() {
    if (!summary) return;
    if (!await confirmExport("pdf", "revenue data")) return;
    exportRevenuePDF(summary);
  }

  async function handleExportExcel() {
    if (!summary) return;
    if (!await confirmExport("excel", "revenue data")) return;
    exportRevenueExcel(summary);
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!summary) return <p>{strings.loading}</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>

      <RevenueFilterBar
        institutes={institutes}
        instituteFilter={instituteFilter}
        onInstituteFilterChange={setInstituteFilter}
        methods={methods}
        methodFilter={methodFilter}
        onMethodFilterChange={setMethodFilter}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onResetFilters={() => {
          setInstituteFilter("");
          setMethodFilter("");
          setDateFrom("");
          setDateTo("");
        }}
        onExportPdf={handleExportPdf}
        onExportExcel={handleExportExcel}
        transactionCount={summary.transaction_count}
      />

      <RevenueKpiRow summary={summary} />
      <RevenueCharts summary={summary} />
      <OutstandingDuesPanel dues={summary.dues} />
    </div>
  );
}
