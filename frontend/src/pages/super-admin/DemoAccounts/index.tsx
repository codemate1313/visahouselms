import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { demoAccountsStrings as strings } from "./DemoAccounts.strings";
import type { CreatedDemo, DemoRow } from "./types";
import { exportDemoAccountsExcel, exportDemoAccountsPDF } from "./exportHelpers";
import { CreatedDemoModal } from "./components/CreatedDemoModal";
import { NewDemoForm } from "./components/NewDemoForm";
import { DemoAccountsFilterBar } from "./components/DemoAccountsFilterBar";
import { DemoAccountsTable } from "./components/DemoAccountsTable";

const EMPTY_FORM = {
  name: "",
  admin_email: "",
  admin_first_name: "",
  admin_last_name: "",
  duration_days: "14",
  course_limit: "2",
  test_limit: "5",
};

export function DemoAccounts() {
  const [rows, setRows] = useState<DemoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedDemo | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<DemoRow[]>("/super-admin/demo-accounts");
      setRows(data);
    } catch {
      setError(strings.errors.load);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const matchesSearch = !query || row.institute_name.toLowerCase().includes(query);
    const matchesState = !stateFilter || row.state === stateFilter;
    return matchesSearch && matchesState;
  });

  function set(field: keyof typeof EMPTY_FORM) {
    return (event: { target: { value: string } }) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { data } = await apiClient.post("/super-admin/demo-accounts", {
        name: form.name,
        admin_email: form.admin_email,
        admin_first_name: form.admin_first_name,
        admin_last_name: form.admin_last_name,
        duration_days: Number(form.duration_days),
        course_limit: Number(form.course_limit),
        test_limit: Number(form.test_limit),
      });
      setCreated({ admin_email: data.admin_email, admin_temp_password: data.admin_temp_password });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.create));
    } finally {
      setSaving(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    await navigator.clipboard.writeText(created.admin_temp_password);
    setCopied(true);
  }

  return (
    <div>
      {created && <CreatedDemoModal created={created} copied={copied} onCopyPassword={copyPassword} onDone={() => setCreated(null)} />}

      {showForm && <NewDemoForm form={form} set={set} error={error} saving={saving} onSubmit={handleSubmit} />}

      <DemoAccountsFilterBar
        search={search}
        onSearchChange={setSearch}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        onExportPdf={() => exportDemoAccountsPDF(filteredRows)}
        onExportExcel={() => exportDemoAccountsExcel(filteredRows)}
        showForm={showForm}
        onToggleForm={() => setShowForm((v) => !v)}
      />

      {loading ? <p>{strings.loading}</p> : <DemoAccountsTable rows={filteredRows} />}
    </div>
  );
}
