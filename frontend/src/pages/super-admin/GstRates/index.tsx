import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmDelete } from "@/components/confirmDialog";
import { Button, DataTableCard, Modal, PageHeader, SearchableSelect } from "@/components/ui";

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
    if (!(await confirmDelete(strings.deleteConfirm))) return;
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
        <p className="ui-loading-copy">{strings.loading}</p>
      ) : (
        <DataTableCard>
          <table className="data-table">
            <thead>
              <tr>
                <th>{strings.table.name}</th>
                <th>{strings.table.percentage}</th>
                <th>{strings.table.taxType}</th>
                <th>{strings.table.status}</th>
                <th>{strings.table.default}</th>
                <th className="table-actions-heading">{strings.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="ui-empty-row">
                    No GST rates configured. Click <strong>{strings.createBtn}</strong> to add one.
                  </td>
                </tr>
              ) : (
                rates.map((rate) => (
                  <tr key={rate.id}>
                    <td>
                      <strong className="table-item-title">{rate.name}</strong>
                    </td>
                    <td>
                      <span className="ui-tax-percent">{rate.percentage}%</span>
                    </td>
                    <td>
                      <span className={`ui-chip ${rate.tax_type === "inclusive" ? "ui-chip-info" : "ui-chip-danger"}`}>
                        {rate.tax_type === "inclusive" ? "Included in Price" : "Added on Top (Exclusive)"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(rate)}
                        className="ui-text-action"
                      >
                        <span className={`ui-chip ${rate.is_active ? "ui-chip-success" : ""}`}>
                          {rate.is_active ? "● Active" : "○ Inactive"}
                        </span>
                      </button>
                    </td>
                    <td>
                      {rate.is_default && (
                        <span className="ui-chip ui-chip-warning">Default</span>
                      )}
                    </td>
                    <td className="table-actions">
                      <div className="ui-consistency-actions">
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
        </DataTableCard>
      )}

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingRate ? strings.modal.editTitle : strings.modal.addTitle}
        size="sm"
      >
        <form onSubmit={handleSave}>
          <div className="ui-field-stack">
            <label htmlFor="gst-rate-name">{strings.modal.nameLabel} *</label>
            <input
              id="gst-rate-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={strings.modal.namePlaceholder}
              required
            />
          </div>

          <div className="ui-field-stack">
            <label htmlFor="gst-rate-percentage">{strings.modal.percentageLabel} *</label>
            <input
              id="gst-rate-percentage"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder={strings.modal.percentagePlaceholder}
              required
            />
          </div>

          <div className="ui-field-stack">
            <label>{strings.modal.taxTypeLabel} *</label>
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

          <div className="ui-checkbox-stack">
            <label className="ui-checkbox-inline">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span>{strings.modal.isActiveLabel}</span>
            </label>

            <label className="ui-checkbox-inline">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span>{strings.modal.isDefaultLabel}</span>
            </label>
          </div>

          {modalError && <p className="error-text mb-4">{modalError}</p>}

          <div className="ui-modal-form-actions">
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
              {strings.modal.cancelBtn}
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {saving ? strings.modal.savingBtn : strings.modal.saveBtn}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
