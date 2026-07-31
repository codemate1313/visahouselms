import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, PageHeader, SearchableSelect } from "@/components/ui";

import { Icon } from "@/components/icons";
import { gstRatesStrings as strings } from "./GstRates.strings";

export interface GstRateRow {
  id: number;
  name: string;
  percentage: number;
  tax_type: "exclusive" | "inclusive";
  is_active: boolean;
  is_default: boolean;
  created_at: string;
}

export function GstRates() {
  const [rates, setRates] = useState<GstRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRate, setEditingRate] = useState<GstRateRow | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [percentage, setPercentage] = useState("18.00");
  const [taxType, setTaxType] = useState<"exclusive" | "inclusive">("exclusive");
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    loadRates();
  }, []);

  async function loadRates() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<GstRateRow[]>("/super-admin/gst-rates");
      setRates(data);
    } catch (err) {
      setError(extractErrorMessage(err, strings.loadError));
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingRate(null);
    setName("");
    setPercentage("18.00");
    setTaxType("exclusive");
    setIsActive(true);
    setIsDefault(false);
    setModalError(null);
    setShowModal(true);
  }

  function openEditModal(rate: GstRateRow) {
    setEditingRate(rate);
    setName(rate.name);
    setPercentage(String(rate.percentage));
    setTaxType(rate.tax_type);
    setIsActive(rate.is_active);
    setIsDefault(rate.is_default);
    setModalError(null);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setModalError(null);

    const payload = {
      name: name.trim(),
      percentage: parseFloat(percentage) || 0,
      tax_type: taxType,
      is_active: isActive,
      is_default: isDefault,
    };

    try {
      if (editingRate) {
        await apiClient.patch(`/super-admin/gst-rates/${editingRate.id}`, payload);
      } else {
        await apiClient.post("/super-admin/gst-rates", payload);
      }
      setShowModal(false);
      await loadRates();
    } catch (err) {
      setModalError(extractErrorMessage(err, strings.saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(rate: GstRateRow) {
    try {
      await apiClient.post(`/super-admin/gst-rates/${rate.id}/toggle-active`);
      await loadRates();
    } catch (err) {
      setError(extractErrorMessage(err, "Failed to toggle GST rate status"));
    }
  }

  async function handleDelete(rate: GstRateRow) {
    if (!window.confirm(strings.deleteConfirm)) return;
    try {
      await apiClient.delete(`/super-admin/gst-rates/${rate.id}`);
      await loadRates();
    } catch (err) {
      setError(extractErrorMessage(err, strings.deleteError));
    }
  }

  return (
    <div>
      <PageHeader
        title={strings.title}
        subtitle={strings.subtitle}
        actions={
          <Button variant="primary" onClick={openAddModal}>
            <Icon name="plus" /> {strings.createBtn}
          </Button>
        }
      />

      {error && <div className="error-banner mb-4">{error}</div>}

      {loading ? (
        <p style={{ padding: 20, color: "#64748b" }}>{strings.loading}</p>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{strings.table.name}</th>
                <th>{strings.table.percentage}</th>
                <th>{strings.table.taxType}</th>
                <th>{strings.table.status}</th>
                <th>{strings.table.default}</th>
                <th style={{ textAlign: "right" }}>{strings.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                    No GST rates configured. Click <strong>{strings.createBtn}</strong> to add one.
                  </td>
                </tr>
              ) : (
                rates.map((rate) => (
                  <tr key={rate.id}>
                    <td>
                      <strong style={{ color: "#0f172a", fontSize: "14px" }}>{rate.name}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: "15px", fontWeight: 800, color: "#e11d2e" }}>
                        {rate.percentage}%
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: rate.tax_type === "inclusive" ? "#eff6ff" : "#fef2f2",
                          color: rate.tax_type === "inclusive" ? "#1d4ed8" : "#b91c1c",
                          border: `1px solid ${rate.tax_type === "inclusive" ? "#bfdbfe" : "#fecaca"}`,
                          textTransform: "capitalize",
                        }}
                      >
                        {rate.tax_type === "inclusive" ? "Included in Price" : "Added on Top (Exclusive)"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(rate)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <span
                          className={`status-chip ${rate.is_active ? "active" : "inactive"}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "12px",
                            fontWeight: 700,
                            background: rate.is_active ? "#ecfdf5" : "#f1f5f9",
                            color: rate.is_active ? "#047857" : "#64748b",
                          }}
                        >
                          {rate.is_active ? "● Active" : "○ Inactive"}
                        </span>
                      </button>
                    </td>
                    <td>
                      {rate.is_default && (
                        <span
                          style={{
                            background: "#fef3c7",
                            color: "#b45309",
                            fontSize: "10.5px",
                            fontWeight: 800,
                            padding: "2px 8px",
                            borderRadius: "10px",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          Default
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <Button variant="secondary" size="small" onClick={() => openEditModal(rate)}>
                          {strings.editBtn}
                        </Button>
                        <Button variant="secondary" size="small" onClick={() => handleDelete(rate)}>
                          {strings.deleteBtn}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {editingRate ? strings.modal.editTitle : strings.modal.addTitle}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
                style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  {strings.modal.nameLabel} *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={strings.modal.namePlaceholder}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  {strings.modal.percentageLabel} *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  placeholder={strings.modal.percentagePlaceholder}
                  required
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                  {strings.modal.taxTypeLabel} *
                </label>
                <SearchableSelect
                  value={taxType}
                  onChange={(val) => setTaxType(val as "exclusive" | "inclusive")}
                  options={[
                    { value: "exclusive", label: "Exclusive", sublabel: "Tax added on top of base price" },
                    { value: "inclusive", label: "Inclusive", sublabel: "Tax included inside total price" },
                  ]}
                  searchable={false}
                />
              </div>


              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span>{strings.modal.isActiveLabel}</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                  />
                  <span>{strings.modal.isDefaultLabel}</span>
                </label>
              </div>

              {modalError && <p className="error-text mb-4">{modalError}</p>}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  {strings.modal.cancelBtn}
                </Button>
                <Button type="submit" variant="primary" loading={saving}>
                  {saving ? strings.modal.savingBtn : strings.modal.saveBtn}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
