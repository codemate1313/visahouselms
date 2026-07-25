import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { instituteOnboardingsStrings as strings } from "./InstituteOnboardings.strings";
import type { OnboardingRow } from "./types";
import { exportOnboardingsExcel, exportOnboardingsPDF } from "./exportHelpers";
import { OnboardingsFilterBar } from "./components/OnboardingsFilterBar";
import { OnboardingsTable } from "./components/OnboardingsTable";

export function InstituteOnboardings() {
  const [rows, setRows] = useState<OnboardingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<OnboardingRow[]>("/super-admin/onboarding");
      setRows(data);
    } catch {
      // handled silently or empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const matchesSearch =
      !query ||
      row.name.toLowerCase().includes(query) ||
      Boolean(row.contact_email?.toLowerCase().includes(query));

    const matchesStatus = !statusFilter || row.onboarding_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <OnboardingsFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onExportPdf={() => exportOnboardingsPDF(filteredRows)}
        onExportExcel={() => exportOnboardingsExcel(filteredRows)}
      />

      {loading ? <p>{strings.loading}</p> : <OnboardingsTable rows={filteredRows} />}
    </div>
  );
}
