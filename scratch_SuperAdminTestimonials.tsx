import { useEffect, useState } from "react";
import { apiClient } from "../../api/client";

interface TestimonialAdminItem {
  id: number;
  student_name: string;
  student_role?: string;
  target_score?: string;
  avatar_url?: string;
  rating: number;
  quote: string;
  is_active: boolean;
  display_order: number;
  created_at?: string;
}

export function SuperAdminTestimonials() {
  const [items, setItems] = useState<TestimonialAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [editingItem, setEditingItem] = useState<Partial<TestimonialAdminItem> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    apiClient
      .get("/super-admin/testimonials")
      .then((res) => {
        setItems(res.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleSave = (e: React.FormEvent) => {
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
      .finally(() => setSaving(false));
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this testimonial?")) return;
    apiClient.delete(`/super-admin/testimonials/${id}`).then(() => {
      fetchItems();
    });
  };

  const handleToggleActive = (item: TestimonialAdminItem) => {
    apiClient.put(`/super-admin/testimonials/${item.id}`, { is_active: !item.is_active }).then(() => {
      fetchItems();
    });
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

  const totalCount = items.length;
  const activeCount = items.filter((i) => i.is_active).length;
  const inactiveCount = items.filter((i) => !i.is_active).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="p-2 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Student Testimonials Management
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 rounded-full">
              {totalCount} Total
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create, order, and toggle verified student reviews shown on the public landing page.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingItem({
                student_name: "",
                student_role: "Computer-Delivered Academic Candidate",
                target_score: "Achieved Band 8.0",
                avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
                rating: 5,
                quote: "",
                is_active: true,
                display_order: items.length + 1,
              });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white text-sm font-bold rounded-2xl shadow-lg shadow-rose-600/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add New Testimonial</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Items</span>
            <span className="text-xl font-extrabold text-slate-900 dark:text-white">{totalCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Published</span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{activeCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Draft / Inactive</span>
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{inactiveCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div>
            <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Student Score</span>
            <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">Band 8.0+</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, role, score or quote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filterStatus === st
                    ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition ${
                viewMode === "grid"
                  ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm"
                  : "text-slate-400"
              }`}
              title="Grid View"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm"
                  : "text-slate-400"
              }`}
              title="Table View"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full mb-3" />
          <p className="text-sm font-semibold text-slate-500">Loading student testimonials...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950 text-rose-500 rounded-full flex items-center justify-center mx-auto text-2xl">
            💬
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Testimonials Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {search
              ? "No testimonials matched your search query. Try clearing search filters."
              : "No student testimonials exist yet. Click 'Add New Testimonial' to create one."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`group relative bg-white dark:bg-slate-800/90 rounded-3xl p-6 border ${
                item.is_active
                  ? "border-slate-200/80 dark:border-slate-700/80 hover:border-rose-300 dark:hover:border-rose-800 shadow-sm hover:shadow-xl hover:shadow-rose-600/5"
                  : "border-slate-200/50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 opacity-75"
              } transition-all duration-300 flex flex-col justify-between`}
            >
              <div>
                {/* Header Row with Avatar, Info, and Score */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="relative shrink-0">
                      <img
                        src={
                          item.avatar_url ||
                          "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
                        }
                        alt={item.student_name}
                        className="w-14 h-14 rounded-full object-cover border-2 border-rose-500/80 shadow-md shrink-0"
                        style={{ width: "56px", height: "56px", minWidth: "56px", minHeight: "56px" }}
                      />
                      <span
                        className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${
                          item.is_active ? "bg-emerald-500" : "bg-slate-400"
                        }`}
                      />
                    </div>

                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base leading-snug">
                        {item.student_name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{item.student_role}</p>
                      {item.target_score && (
                        <span className="inline-block mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200/50 dark:border-rose-800/40">
                          {item.target_score}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 rounded-xl shrink-0">
                    #{item.display_order}
                  </span>
                </div>

                {/* Rating Stars */}
                <div className="flex items-center gap-1 mb-3 text-amber-400 text-sm">
                  {Array.from({ length: item.rating || 5 }).map((_, i) => (
                    <span key={i}>★</span>
                  ))}
                  <span className="text-xs font-semibold text-slate-400 ml-1">({item.rating}.0)</span>
                </div>

                {/* Quote Box */}
                <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 mb-6">
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                    "{item.quote}"
                  </p>
                </div>
              </div>

              {/* Action Bar Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-bold transition ${
                    item.is_active
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${item.is_active ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
                  <span>{item.is_active ? "Active" : "Inactive"}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(item);
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition font-semibold text-xs flex items-center gap-1"
                    title="Edit Testimonial"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition font-semibold text-xs flex items-center gap-1"
                    title="Delete Testimonial"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6">Student</th>
                  <th className="py-4 px-6">Role &amp; Score</th>
                  <th className="py-4 px-6">Rating</th>
                  <th className="py-4 px-6">Quote Preview</th>
                  <th className="py-4 px-6">Order</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-sm">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            item.avatar_url ||
                            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
                          }
                          alt={item.student_name}
                          className="w-10 h-10 rounded-full object-cover border border-rose-500 shrink-0"
                          style={{ width: "40px", height: "40px", minWidth: "40px", minHeight: "40px" }}
                        />
                        <span className="font-bold text-slate-900 dark:text-white">{item.student_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs text-slate-500 dark:text-slate-400">{item.student_role}</div>
                      <span className="inline-block mt-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded">
                        {item.target_score}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-amber-400 text-xs">
                      {"★".repeat(item.rating || 5)}
                    </td>
                    <td className="py-4 px-6 max-w-xs truncate text-xs text-slate-600 dark:text-slate-300 italic">
                      "{item.quote}"
                    </td>
                    <td className="py-4 px-6 font-bold text-xs text-slate-500">#{item.display_order}</td>
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {item.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950 rounded-lg"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950 rounded-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg p-1"
            >
              ✕
            </button>

            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-6">
              {editingItem.id ? "Edit Student Testimonial" : "Create New Testimonial"}
            </h2>

            <form onSubmit={handleSave} className="space-y-5">
              {/* Avatar Live Preview & URL */}
              <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <img
                  src={
                    editingItem.avatar_url ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"
                  }
                  alt="Preview"
                  className="w-14 h-14 rounded-full object-cover border-2 border-rose-500 shrink-0"
                  style={{ width: "56px", height: "56px", minWidth: "56px", minHeight: "56px" }}
                />
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Avatar Image URL (Unsplash or direct image link)
                  </label>
                  <input
                    type="url"
                    value={editingItem.avatar_url || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, avatar_url: e.target.value })}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingItem.student_name || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, student_name: e.target.value })}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target / Achieved Score
                  </label>
                  <input
                    type="text"
                    value={editingItem.target_score || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, target_score: e.target.value })}
                    placeholder="e.g. Achieved Band 8.5"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Student Role / Candidate Tag
                  </label>
                  <input
                    type="text"
                    value={editingItem.student_role || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, student_role: e.target.value })}
                    placeholder="e.g. Computer-Delivered Academic Candidate"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Star Rating (1 - 5)
                  </label>
                  <select
                    value={editingItem.rating || 5}
                    onChange={(e) => setEditingItem({ ...editingItem, rating: parseInt(e.target.value) || 5 })}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value={5}>5 Stars ★★★★★</option>
                    <option value={4}>4 Stars ★★★★☆</option>
                    <option value={3}>3 Stars ★★★☆☆</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Testimonial Quote / Review Text *
                </label>
                <textarea
                  required
                  rows={4}
                  value={editingItem.quote || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, quote: e.target.value })}
                  placeholder="Share the student's review quote..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 items-center bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Display Order Priority
                  </label>
                  <input
                    type="number"
                    value={editingItem.display_order || 1}
                    onChange={(e) => setEditingItem({ ...editingItem, display_order: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center gap-3 pt-3">
                  <input
                    type="checkbox"
                    id="modal_is_active"
                    checked={editingItem.is_active ?? true}
                    onChange={(e) => setEditingItem({ ...editingItem, is_active: e.target.checked })}
                    className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
                  />
                  <label htmlFor="modal_is_active" className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Publish to Landing Page
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 text-sm font-bold bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white rounded-xl shadow-lg shadow-rose-600/20 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Testimonial"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
