import { useEffect, useState } from "react";

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
}

export function SuperAdminTestimonials() {
  const [items, setItems] = useState<TestimonialAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Partial<TestimonialAdminItem> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchItems = () => {
    setLoading(true);
    fetch("/api/v1/super-admin/testimonials")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setItems(data);
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

    const isEdit = Boolean(editingItem.id);
    const url = isEdit ? `/api/v1/super-admin/testimonials/${editingItem.id}` : "/api/v1/super-admin/testimonials";
    const method = isEdit ? "PUT" : "POST";

    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingItem),
    })
      .then((res) => {
        if (res.ok) {
          setIsModalOpen(false);
          setEditingItem(null);
          fetchItems();
        }
      });
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this testimonial?")) return;
    fetch(`/api/v1/super-admin/testimonials/${id}`, { method: "DELETE" }).then((res) => {
      if (res.ok) fetchItems();
    });
  };

  const handleToggleActive = (item: TestimonialAdminItem) => {
    fetch(`/api/v1/super-admin/testimonials/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !item.is_active }),
    }).then((res) => {
      if (res.ok) fetchItems();
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Student Testimonials Management</h1>
          <p className="text-sm text-gray-500">Add, edit, reorder, or toggle student testimonials shown on the landing page.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingItem({
              student_name: "",
              student_role: "Academic IELTS Candidate",
              target_score: "Band 7.5+",
              avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
              rating: 5,
              quote: "",
              is_active: true,
              display_order: items.length + 1,
            });
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition"
        >
          + Add New Testimonial
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading testimonials...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border ${
                item.is_active
                  ? "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700"
                  : "bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-800 opacity-60"
              } shadow-sm flex flex-col justify-between`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80"}
                      alt={item.student_name}
                      className="w-10 h-10 rounded-full object-cover border border-rose-500"
                    />
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm">{item.student_name}</h3>
                      <span className="text-xs text-gray-500">{item.student_role}</span>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 font-bold rounded-md">
                    {item.target_score}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 italic mb-4">"{item.quote}"</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-700/50">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                      item.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {item.is_active ? "Active" : "Inactive"}
                  </button>
                  <span className="text-xs text-gray-400">Order: {item.display_order}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(item);
                      setIsModalOpen(true);
                    }}
                    className="text-xs px-2.5 py-1 text-indigo-600 hover:bg-indigo-50 rounded-lg font-semibold"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-xs px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {editingItem.id ? "Edit Testimonial" : "Create Testimonial"}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Student Name</label>
                <input
                  type="text"
                  required
                  value={editingItem.student_name || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, student_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Target/Achieved Score</label>
                <input
                  type="text"
                  value={editingItem.target_score || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, target_score: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Role / Description</label>
                <input
                  type="text"
                  value={editingItem.student_role || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, student_role: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Avatar Image URL</label>
                <input
                  type="text"
                  value={editingItem.avatar_url || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, avatar_url: e.target.value })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Testimonial Quote</label>
              <textarea
                required
                rows={3}
                value={editingItem.quote || ""}
                onChange={(e) => setEditingItem({ ...editingItem, quote: e.target.value })}
                className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
                <input
                  type="number"
                  value={editingItem.display_order || 0}
                  onChange={(e) => setEditingItem({ ...editingItem, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-4">
                <input
                  type="checkbox"
                  id="is_active_cb"
                  checked={editingItem.is_active ?? true}
                  onChange={(e) => setEditingItem({ ...editingItem, is_active: e.target.checked })}
                />
                <label htmlFor="is_active_cb" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Visible on Home Page
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700">
                Save Testimonial
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
