import { useEffect, useMemo, useState, type FormEvent } from "react";
import { grammarContentApi, type GrammarContentItem } from "@/api/grammarContentApi";
import { confirmDelete } from "@/components/confirmDialog";
import { Icon } from "@/components/icons";
import { RowActionMenu } from "@/components/RowActionMenu";
import { Badge, Button, DataTableCard, Input, Modal, SearchInput, Textarea } from "@/components/ui";
import "./GrammarContentPage.css";

export function GrammarContentPage() {
  const [items, setItems] = useState<GrammarContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GrammarContentItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPdfFile, setFormPdfFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await grammarContentApi.getInstructorContents();
      setItems(res.items);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load grammar content materials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCount = useMemo(() => items.filter((i) => i.is_active).length, [items]);
  const disabledCount = useMemo(() => items.filter((i) => !i.is_active).length, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        item.file_name.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active) ||
        (statusFilter === "disabled" && !item.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormDescription("");
    setFormIsActive(true);
    setFormPdfFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: GrammarContentItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDescription(item.description || "");
    setFormIsActive(item.is_active);
    setFormPdfFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (item: GrammarContentItem) => {
    try {
      const updated = await grammarContentApi.toggleContentStatus(item.id);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to toggle status.");
    }
  };

  const handleDelete = async (item: GrammarContentItem) => {
    const confirmed = await confirmDelete(
      `Are you sure you want to delete "${item.title}"? This cannot be undone.`,
      "Delete Grammar Content"
    );
    if (!confirmed) return;

    try {
      await grammarContentApi.deleteContent(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to delete item.");
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim()) {
      setFormError("Title is mandatory.");
      return;
    }

    if (!editingItem && !formPdfFile) {
      setFormError("A PDF file is mandatory.");
      return;
    }

    if (formPdfFile && !formPdfFile.name.toLowerCase().endsWith(".pdf")) {
      setFormError("Selected file must be a PDF document (.pdf).");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("title", formTitle.trim());
      if (formDescription.trim()) {
        formData.append("description", formDescription.trim());
      }
      formData.append("is_active", formIsActive ? "true" : "false");
      if (formPdfFile) {
        formData.append("pdf_file", formPdfFile);
      }

      if (editingItem) {
        const updated = await grammarContentApi.updateContent(editingItem.id, formData);
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      } else {
        const created = await grammarContentApi.createContent(formData);
        setItems((prev) => [created, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err?.response?.data?.detail || "An error occurred while saving.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const isFiltering = search.trim() !== "" || statusFilter !== "all";

  return (
    <div className="gc-container">
      {error && <div className="gc-error-banner">{error}</div>}

      {/* Modern Filter, Search & Action Bar */}
      <div className="gc-toolbar-card">
        <div className="gc-search-filter-group">
          <div className="gc-search-wrapper">
            <SearchInput
              placeholder="Search by title, description, or file name..."
              value={search}
              onChange={setSearch}
              className="gc-search-input"
            />
          </div>

          <div className="gc-status-filter-pills" role="tablist" aria-label="Status filter">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "all"}
              className={`gc-filter-pill${statusFilter === "all" ? " is-active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              <span>All</span>
              <span className="gc-pill-count">{items.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "active"}
              className={`gc-filter-pill${statusFilter === "active" ? " is-active" : ""}`}
              onClick={() => setStatusFilter("active")}
            >
              <span>Active</span>
              <span className="gc-pill-count">{activeCount}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === "disabled"}
              className={`gc-filter-pill${statusFilter === "disabled" ? " is-active" : ""}`}
              onClick={() => setStatusFilter("disabled")}
            >
              <span>Disabled</span>
              <span className="gc-pill-count">{disabledCount}</span>
            </button>
          </div>
        </div>

        <div className="gc-toolbar-actions">
          <Button variant="primary" onClick={openCreateModal} className="gc-add-btn">
            <Icon name="plus" /> Add Grammar Content
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="gc-loading-state">
          <div className="gc-loading-spinner" />
          <p>Loading grammar content...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="gc-empty-card">
          <div className="gc-empty-icon">📚</div>
          <h3 className="gc-empty-title">No Grammar Content Added</h3>
          <p className="gc-empty-desc">
            Upload PDF materials to share grammar resources with students.
          </p>
          <Button variant="primary" onClick={openCreateModal}>
            <Icon name="plus" /> Add First PDF Content
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="gc-empty-card gc-no-match-card">
          <div className="gc-empty-icon">🔍</div>
          <h3 className="gc-empty-title">No Matching Content</h3>
          <p className="gc-empty-desc">
            No materials match your current search or filter criteria.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
            }}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="gc-table-container">
          {isFiltering && (
            <div className="gc-filter-status-row">
              <span>
                Showing <strong>{filteredItems.length}</strong> of <strong>{items.length}</strong> materials
              </span>
              <button
                type="button"
                className="gc-clear-filter-btn"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          )}

          <DataTableCard>
            <table className="data-table gc-table">
              <thead>
                <tr>
                  <th className="gc-col-title">TITLE</th>
                  <th className="gc-col-desc">DESCRIPTION</th>
                  <th className="gc-col-file">FILE</th>
                  <th className="gc-col-status">STATUS</th>
                  <th className="table-actions-heading col-actions gc-col-actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td className="gc-col-title">
                      <div className="gc-title-wrap">
                        <span className="gc-title-text" title={item.title}>
                          {item.title}
                        </span>
                        {item.created_at && (
                          <span className="gc-date-subtext">
                            Added {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="gc-col-desc">
                      <div className="gc-desc-text">
                        {item.description ? (
                          item.description
                        ) : (
                          <span className="gc-desc-empty">No description</span>
                        )}
                      </div>
                    </td>
                    <td className="gc-col-file">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="gc-file-info-link"
                        title={`Open ${item.file_name} in new tab`}
                      >
                        <div className="gc-file-icon">
                          <Icon name="filePdf" />
                        </div>
                        <div className="gc-file-details">
                          <div className="gc-file-name" title={item.file_name}>
                            {item.file_name}
                          </div>
                          <div className="gc-file-size">
                            {formatFileSize(item.file_size)}
                          </div>
                        </div>
                      </a>
                    </td>
                    <td className="gc-col-status">
                      <Badge tone={item.is_active ? "green" : "gray"}>
                        {item.is_active ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="table-actions col-actions gc-col-actions">
                      <div className="row-actions-inline">
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="action-btn-icon action-neutral gc-action-eye-btn"
                          title="View PDF"
                          data-tooltip="View PDF"
                          aria-label={`View PDF for ${item.title}`}
                        >
                          <Icon name="eye" />
                        </a>

                        <button
                          type="button"
                          className="action-btn-icon action-neutral"
                          onClick={() => openEditModal(item)}
                          title="Edit"
                          data-tooltip="Edit"
                          aria-label={`Edit ${item.title}`}
                        >
                          <Icon name="edit" />
                        </button>

                        <RowActionMenu
                          items={[
                            <button key="toggle" type="button" onClick={() => handleToggleStatus(item)}>
                              <Icon name={item.is_active ? "toggleOff" : "toggleOn"} />
                              <span>{item.is_active ? "Deactivate" : "Activate"}</span>
                            </button>,
                            <button key="delete" type="button" className="danger" onClick={() => handleDelete(item)}>
                              <Icon name="trash" />
                              <span>Delete</span>
                            </button>,
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableCard>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Grammar Content" : "Add Grammar Content"}
        size="md"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : editingItem ? "Update Content" : "Upload & Save"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="gc-form">
          {formError && <div className="gc-error-banner">{formError}</div>}

          <Input
            label={
              <span>
                Title <span style={{ color: "var(--danger, #dc2626)" }}>*</span>
              </span>
            }
            type="text"
            placeholder="e.g. Tenses & Active Passive Rules"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            required
          />

          <Textarea
            label={
              <span>
                Description <span className="gc-form-label-optional">(Optional)</span>
              </span>
            }
            placeholder="Brief overview of the grammar topics covered in this PDF..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            rows={3}
          />

          <div className="gc-form-group">
            <label className="gc-form-label">
              PDF File {!editingItem && <span style={{ color: "var(--danger, #dc2626)" }}>*</span>}
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="gc-file-input"
              onChange={(e) => setFormPdfFile(e.target.files?.[0] || null)}
            />
            {editingItem && (
              <div className="gc-file-hint">
                Current file: {editingItem.file_name}. Leave blank to keep existing file.
              </div>
            )}
          </div>

          <div className="gc-form-group">
            <label className="gc-checkbox-label">
              <input
                type="checkbox"
                className="gc-checkbox-input"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              Active (Visible to Students in Study Material)
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
