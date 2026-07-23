import { useEffect, useState } from "react";

export function SuperAdminSEOSettings() {
  const [formData, setFormData] = useState({
    site_name: "IELTS LMS Pro",
    default_title: "IELTS LMS Pro | Computer-Delivered Exam Platform & AI Feedback",
    title_template: "%s | IELTS LMS Pro",
    default_meta_description: "Experience authentic computer-delivered IELTS environments with AI Speaking & Writing scoring.",
    default_meta_keywords: "IELTS LMS, IELTS Practice, AI IELTS Evaluation, Computer Delivered IELTS",
    default_og_image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80",
    twitter_handle: "@ieltslmspro",
    robots_txt: "User-agent: *\nAllow: /",
    custom_head_tags: "",
  });

  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/v1/super-admin/seo-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFormData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedSuccess(false);

    fetch("/api/v1/super-admin/seo-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    }).then((res) => {
      setLoading(false);
      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Centralized SEO &amp; Meta Tag Settings</h1>
        <p className="text-sm text-gray-500">Configure site-wide meta titles, descriptions, OpenGraph share images, keywords, and robots indexing.</p>
      </div>

      {savedSuccess && (
        <div className="mb-4 p-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-sm font-bold rounded-xl border border-emerald-200 dark:border-emerald-800">
          ✓ SEO Settings updated successfully! Public pages will now reflect these tags dynamically.
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 space-y-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Site Brand Name</label>
            <input
              type="text"
              required
              value={formData.site_name}
              onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Title Template Pattern</label>
            <input
              type="text"
              required
              value={formData.title_template}
              onChange={(e) => setFormData({ ...formData, title_template: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white font-mono"
            />
            <span className="text-[11px] text-gray-400">Use %s as page title placeholder (e.g. %s | IELTS LMS)</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Default Fallback Document Title</label>
          <input
            type="text"
            required
            value={formData.default_title}
            onChange={(e) => setFormData({ ...formData, default_title: e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Global Meta Description</label>
          <textarea
            required
            rows={3}
            value={formData.default_meta_description}
            onChange={(e) => setFormData({ ...formData, default_meta_description: e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Global SEO Keywords (Comma separated)</label>
          <textarea
            rows={2}
            value={formData.default_meta_keywords}
            onChange={(e) => setFormData({ ...formData, default_meta_keywords: e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Default Social Share Image URL (OpenGraph)</label>
            <input
              type="text"
              value={formData.default_og_image || ""}
              onChange={(e) => setFormData({ ...formData, default_og_image: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Twitter / X Handle</label>
            <input
              type="text"
              value={formData.twitter_handle || ""}
              onChange={(e) => setFormData({ ...formData, twitter_handle: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Robots.txt Content</label>
          <textarea
            rows={3}
            value={formData.robots_txt || ""}
            onChange={(e) => setFormData({ ...formData, robots_txt: e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white font-mono"
          />
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl transition"
          >
            {loading ? "Saving..." : "Save SEO Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
