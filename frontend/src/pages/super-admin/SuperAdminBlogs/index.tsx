import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { confirmAction, confirmDelete } from "@/components/confirmDialog";
import { usePageTitleStore } from "@/store/pageTitleStore";
import "./SuperAdminBlogs.css";
import { superAdminBlogsStrings as strings } from "./SuperAdminBlogs.strings";
import type { BlogAdminItem, BlogStatusFilter, BlogViewMode } from "./types";
import { BlogsToolbar } from "./components/BlogsToolbar";
import { BlogGridView } from "./components/BlogGridView";
import { BlogTableView } from "./components/BlogTableView";

export function SuperAdminBlogs() {
  const [items, setItems] = useState<BlogAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<BlogStatusFilter>("ALL");
  const [viewMode, setViewMode] = useState<BlogViewMode>("grid");

  const fetchItems = () => {
    setLoading(true);
    apiClient
      .get("/super-admin/blogs")
      .then((res) => {
        setItems(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDelete = async (id: number) => {
    const item = items.find((i) => i.id === id);
    const title = item ? item.title : strings.deleteFallbackTitle;
    if (!(await confirmDelete(strings.deleteConfirm(title), strings.deleteConfirmTitle))) return;
    apiClient.delete(`/super-admin/blogs/${id}`).then(() => {
      fetchItems();
    });
  };

  const handleToggleActive = async (item: BlogAdminItem) => {
    const newStatus = item.is_published ? strings.draftLabel : strings.publishedLabel;
    const confirmed = await confirmAction(strings.toggleVisibilityConfirm(item.title, newStatus), {
      title: strings.toggleVisibilityTitle,
      confirmText: item.is_published ? strings.unpublishLabel : strings.publishLabel,
      variant: item.is_published ? "warning" : "primary",
    });
    if (!confirmed) return;
    const updated = { is_published: !item.is_published };
    apiClient.put(`/super-admin/blogs/${item.id}`, updated).then(() => {
      fetchItems();
    });
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase()) ||
      item.author_name.toLowerCase().includes(search.toLowerCase());

    if (filterStatus === "PUBLISHED") return matchesSearch && item.is_published;
    if (filterStatus === "DRAFT") return matchesSearch && !item.is_published;
    return matchesSearch;
  });

  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  useEffect(() => {
    setItemCount(filteredItems.length);
    return () => setItemCount(null);
  }, [filteredItems.length, setItemCount]);

  return (
    <div className="sab-container">
      <BlogsToolbar
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {loading ? (
        <div className="sab-loading">
          <div className="sab-spinner"></div>
          <p>{strings.loading}</p>
        </div>
      ) : filteredItems.length === 0 ? null : viewMode === "grid" ? (
        <BlogGridView items={filteredItems} onToggleActive={handleToggleActive} onDelete={handleDelete} />
      ) : (
        <BlogTableView items={filteredItems} onToggleActive={handleToggleActive} onDelete={handleDelete} />
      )}
    </div>
  );
}
