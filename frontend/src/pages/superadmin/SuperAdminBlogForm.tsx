import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

export function SuperAdminBlogForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    summary: "",
    content_markdown: "",
    featured_image_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80",
    category: "Speaking Tips",
    tags: "IELTS, Preparation, Speaking, Writing",
    author_name: "IELTS LMS Editorial Team",
    read_time_minutes: 5,
    is_published: true,
    meta_title: "",
    meta_description: "",
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    fetch("/api/v1/super-admin/blogs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: any[]) => {
        const item = data.find((b) => String(b.id) === String(id));
        if (item) {
          setFormData(item);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, isEdit]);

  const handleTitleChange = (newTitle: string) => {
    const generatedSlug = newTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");

    setFormData((prev) => ({
      ...prev,
      title: newTitle,
      slug: prev.slug && isEdit ? prev.slug : generatedSlug,
      meta_title: prev.meta_title ? prev.meta_title : `${newTitle} | IELTS LMS`,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const url = isEdit ? `/api/v1/super-admin/blogs/${id}` : "/api/v1/super-admin/blogs";
    const method = isEdit ? "PUT" : "POST";

    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    }).then((res) => {
      setLoading(false);
      if (res.ok) {
        navigate("/super-admin/blogs");
      }
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/super-admin/blogs" className="text-xs text-rose-600 font-bold hover:underline mb-1 inline-block">
            ← Back to Blogs List
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? "Edit Educational Article" : "Create New Educational Article"}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 space-y-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Article Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
              placeholder="e.g. 10 Strategies to Score Band 8.0 in Speaking"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">URL Slug *</label>
            <input
              type="text"
              required
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            >
              <option value="Speaking Tips">Speaking Tips</option>
              <option value="Reading Passages">Reading Passages</option>
              <option value="Writing Assessor">Writing Assessor</option>
              <option value="General Guidance">General Guidance</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Author Name</label>
            <input
              type="text"
              value={formData.author_name}
              onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Est. Read Time (Minutes)</label>
            <input
              type="number"
              value={formData.read_time_minutes}
              onChange={(e) => setFormData({ ...formData, read_time_minutes: parseInt(e.target.value) || 5 })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Featured Image URL (Unsplash or CDN)</label>
          <input
            type="text"
            value={formData.featured_image_url || ""}
            onChange={(e) => setFormData({ ...formData, featured_image_url: e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            placeholder="https://images.unsplash.com/..."
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Short Summary (Excerpt) *</label>
          <textarea
            required
            rows={2}
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value, meta_description: formData.meta_description || e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Article Content (Markdown) *</label>
          <textarea
            required
            rows={12}
            value={formData.content_markdown}
            onChange={(e) => setFormData({ ...formData, content_markdown: e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white font-mono"
            placeholder="# Title&#10;&#10;## Subheading&#10;&#10;Paragraph content..."
          />
        </div>

        {/* SEO Meta Tags Box */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">SEO &amp; Social Meta Tags</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">SEO Title Tag</label>
              <input
                type="text"
                value={formData.meta_title || ""}
                onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                className="w-full px-3 py-2 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (Comma separated)</label>
              <input
                type="text"
                value={formData.tags || ""}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">SEO Meta Description</label>
            <input
              type="text"
              value={formData.meta_description || ""}
              onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
              className="w-full px-3 py-2 text-xs border rounded-lg dark:bg-slate-800 dark:border-slate-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_published_cb"
              checked={formData.is_published}
              onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
            />
            <label htmlFor="is_published_cb" className="text-xs font-bold text-gray-700 dark:text-gray-300">
              Publish Live Immediately
            </label>
          </div>

          <div className="flex gap-3">
            <Link to="/super-admin/blogs" className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold bg-rose-600 text-white rounded-xl hover:bg-rose-700"
            >
              {loading ? "Saving..." : isEdit ? "Update Article" : "Publish Article"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
