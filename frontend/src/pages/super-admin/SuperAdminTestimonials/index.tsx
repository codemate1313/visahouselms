import { type DragEvent, type FormEvent, useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { useToastStore } from "@/store/toastStore";
import "./SuperAdminTestimonials.css";
import { superAdminTestimonialsStrings as strings } from "./SuperAdminTestimonials.strings";
import type { TestimonialAdminItem, TestimonialStatusFilter, TestimonialViewMode } from "./types";
import { TestimonialsToolbar } from "./components/TestimonialsToolbar";
import { TestimonialGridView } from "./components/TestimonialGridView";
import { TestimonialTableView } from "./components/TestimonialTableView";
import { TestimonialFormModal } from "./components/TestimonialFormModal";

export function SuperAdminTestimonials() {
  // This screen has no error banner, so a failed write had nowhere to go
  // and simply looked like it had worked. A toast is the smallest thing
  // that makes a rejection visible here.
  const showError = useToastStore((state) => state.showError);
  const [items, setItems] = useState<TestimonialAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<TestimonialStatusFilter>("ALL");
  const [viewMode, setViewMode] = useState<TestimonialViewMode>("grid");
  const [editingItem, setEditingItem] = useState<Partial<TestimonialAdminItem> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fetchItems = () => {
    setLoading(true);
    apiClient
      .get<TestimonialAdminItem[]>("/super-admin/testimonials")
      .then((res) => {
        setItems(res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDragStart = (e: DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...items];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, movedItem);

    const reordered = updated.map((item, idx) => ({
      ...item,
      display_order: idx + 1,
    }));

    setItems(reordered);
    setDraggedIndex(null);
    setDragOverIndex(null);

    apiClient
      .put(
        "/super-admin/testimonials/reorder",
        reordered.map((item) => ({ id: item.id, display_order: item.display_order }))
      )
      .catch(() => fetchItems());
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!editingItem?.student_name || !editingItem?.quote) return;

    setSaving(true);
    const isEdit = Boolean(editingItem.id);
    const url = isEdit ? `/super-admin/testimonials/${editingItem.id}` : "/super-admin/testimonials";
    const promise = isEdit ? apiClient.put(url, editingItem) : apiClient.post(url, editingItem);

    promise
      .then(() => {
        setIsModalOpen(false);
        setEditingItem(null);
        fetchItems();
      })
      // Without this the save just stopped: the spinner cleared via `finally`,
      // the modal stayed open with the work still in it, and nothing said why.
      // The modal is deliberately left open so the entered content survives.
      .catch((err: unknown) =>
        showError(extractErrorMessage(err, "Could not save this testimonial.")),
      )
      .finally(() => setSaving(false));
  };

  const handleDelete = async (id: number) => {
    const item = items.find((i) => i.id === id);
    const name = item?.student_name || strings.deleteFallbackName;
    if (!(await confirmDelete(strings.deleteConfirm(name), strings.deleteConfirmTitle))) return;
    apiClient.delete(`/super-admin/testimonials/${id}`).then(() => {
      fetchItems();
    }).catch((err: unknown) => showError(extractErrorMessage(err, "Could not update this testimonial.")));
  };

  const handleToggleActive = async (item: TestimonialAdminItem) => {
    const newStatus = item.is_active ? strings.draftLabel : strings.publishedLabel;
    const confirmed = await confirmAction(strings.toggleVisibilityConfirm(item.student_name, newStatus), {
      title: strings.toggleVisibilityTitle,
      confirmText: item.is_active ? strings.unpublishLabel : strings.publishLabel,
      variant: item.is_active ? "warning" : "primary",
    });
    if (!confirmed) return;
    apiClient.put(`/super-admin/testimonials/${item.id}`, { is_active: !item.is_active }).then(() => {
      fetchItems();
    }).catch((err: unknown) => showError(extractErrorMessage(err, "Could not update this testimonial.")));
  };

  const handleAdd = () => {
    setEditingItem({
      student_name: "",
      ...strings.newTestimonialDefaults,
      quote: "",
      is_active: true,
      display_order: items.length + 1,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (item: TestimonialAdminItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.student_name.toLowerCase().includes(search.toLowerCase()) ||
      (item.student_role && item.student_role.toLowerCase().includes(search.toLowerCase())) ||
      (item.target_score && item.target_score.toLowerCase().includes(search.toLowerCase())) ||
      item.quote.toLowerCase().includes(search.toLowerCase());

    if (filterStatus === "ACTIVE") return matchesSearch && item.is_active;
    if (filterStatus === "INACTIVE") return matchesSearch && !item.is_active;
    return matchesSearch;
  });

  useEffect(() => {
    setItemCount(filteredItems.length);
    return () => setItemCount(null);
  }, [filteredItems.length, setItemCount]);

  const dragState = { draggedIndex, dragOverIndex };

  return (
    <div className="sat-container">
      <TestimonialsToolbar
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAdd={handleAdd}
      />

      {loading ? (
        <div className="sat-loading">
          <div className="sat-spinner"></div>
          <p>{strings.loading}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="sat-empty">
          <div className="sat-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3>{strings.emptyTitle}</h3>
          <p>{strings.emptyHint}</p>
        </div>
      ) : viewMode === "grid" ? (
        <TestimonialGridView
          items={filteredItems}
          dragState={dragState}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
        />
      ) : (
        <TestimonialTableView
          items={filteredItems}
          dragState={dragState}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDrop={handleDrop}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggleActive}
        />
      )}

      {isModalOpen && editingItem && (
        <TestimonialFormModal
          editingItem={editingItem}
          onChange={setEditingItem}
          saving={saving}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
