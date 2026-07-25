import { type FormEvent, useEffect, useState } from "react";
import { API_BASE_URL } from "@/api/client";
import { RequiredMark } from "@/components/ui";
import { seoSettingsStrings as strings } from "./SuperAdminSEOSettings.strings";

export function SuperAdminSEOSettings() {
  const [formData, setFormData] = useState(strings.defaults);

  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/super-admin/seo-settings`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setFormData(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSavedSuccess(false);

    fetch(`${API_BASE_URL}/super-admin/seo-settings`, {
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{strings.heading}</h1>
        <p className="text-sm text-gray-500">{strings.subheading}</p>
      </div>

      {savedSuccess && (
        <div className="mb-4 p-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 text-sm font-bold rounded-xl border border-emerald-200 dark:border-emerald-800">
          {strings.savedBanner}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 space-y-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{strings.fields.siteName}<RequiredMark /></label>
            <input
              type="text"
              required
              value={formData.site_name}
              onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{strings.fields.titleTemplate}<RequiredMark /></label>
            <input
              type="text"
              required
              value={formData.title_template}
              onChange={(e) => setFormData({ ...formData, title_template: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white font-mono"
            />
            <span className="text-[11px] text-gray-400">{strings.fields.titleTemplateHint}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{strings.fields.defaultTitle}<RequiredMark /></label>
          <input
            type="text"
            required
            value={formData.default_title}
            onChange={(e) => setFormData({ ...formData, default_title: e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{strings.fields.metaDescription}<RequiredMark /></label>
          <textarea
            required
            rows={3}
            value={formData.default_meta_description}
            onChange={(e) => setFormData({ ...formData, default_meta_description: e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{strings.fields.metaKeywords}</label>
          <textarea
            rows={2}
            value={formData.default_meta_keywords}
            onChange={(e) => setFormData({ ...formData, default_meta_keywords: e.target.value })}
            className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{strings.fields.ogImage}</label>
            <input
              type="text"
              value={formData.default_og_image || ""}
              onChange={(e) => setFormData({ ...formData, default_og_image: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{strings.fields.twitterHandle}</label>
            <input
              type="text"
              value={formData.twitter_handle || ""}
              onChange={(e) => setFormData({ ...formData, twitter_handle: e.target.value })}
              className="w-full px-3 py-2 text-sm border rounded-xl dark:bg-slate-900 dark:border-slate-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">{strings.fields.robotsTxt}</label>
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
            {loading ? strings.saveBusy : strings.saveLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
