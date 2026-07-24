import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import "./SuperAdminBlogForm.css";

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
  const [imgError, setImgError] = useState(false);

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
    <div className="sab-form-container">
      {/* Top Header Bar */}
      <div className="sab-form-header">
        <div className="sab-form-header-left">
          <Link to="/super-admin/blogs" className="sab-back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Back to Articles</span>
          </Link>
          <div className="sab-form-title-group">
            <h1>{isEdit ? "Edit Educational Article" : "Create Educational Article"}</h1>
            <p>Draft, optimize SEO metadata, and publish learning content</p>
          </div>
        </div>

        <div className="sab-form-header-actions">
          <Link to="/super-admin/blogs" className="sat-btn sat-btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            form="blog-article-form"
            disabled={loading}
            className="sat-btn sat-btn-primary"
          >
            {loading ? "Saving..." : isEdit ? "Update Article" : "Publish Article"}
          </button>
        </div>
      </div>

      {/* 2-Column Editor Workspace */}
      <form id="blog-article-form" onSubmit={handleSubmit}>
        <div className="sab-form-layout">
          {/* Main Article Content Panel */}
          <div className="sab-form-main-card">
            <div className="sab-field-group">
              <label>
                <span>Article Title *</span>
                {formData.slug && <span className="sab-slug-hint">/{formData.slug}</span>}
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="sab-input-field"
                placeholder="e.g. 10 Strategies to Score Band 8.0 in IELTS Speaking"
              />
            </div>

            <div className="sab-field-group">
              <label>URL Slug *</label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="sab-input-field sab-mono-editor"
                placeholder="ielts-speaking-band-8-strategies"
              />
            </div>

            <div className="sab-field-group">
              <label>Short Summary (Excerpt) *</label>
              <textarea
                required
                rows={3}
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value, meta_description: formData.meta_description || e.target.value })}
                className="sab-input-field sab-textarea-field"
                placeholder="Brief high-level summary displayed on blog cards and search results..."
              />
            </div>

            <div className="sab-field-group">
              <label>Article Content (Markdown) *</label>
              <textarea
                required
                rows={14}
                value={formData.content_markdown}
                onChange={(e) => setFormData({ ...formData, content_markdown: e.target.value })}
                className="sab-input-field sab-textarea-field sab-mono-editor"
                placeholder="# Title&#10;&#10;## Key Section Heading&#10;&#10;Write comprehensive article content with standard Markdown formatting..."
              />
            </div>
          </div>

          {/* Right Media & Metadata Panel */}
          <div className="sab-form-side-card">
            {/* Live Featured Cover Preview */}
            <div className="sab-field-group">
              <label>Cover Photo Preview</label>
              <div className="sab-image-preview-container">
                {formData.featured_image_url && !imgError ? (
                  <img
                    src={formData.featured_image_url}
                    alt="Cover preview"
                    className="sab-image-preview-img"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="sab-image-preview-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>No Image Preview</span>
                  </div>
                )}
              </div>
            </div>

            <div className="sab-field-group">
              <label>Featured Image URL</label>
              <input
                type="url"
                value={formData.featured_image_url || ""}
                onChange={(e) => {
                  setImgError(false);
                  setFormData({ ...formData, featured_image_url: e.target.value });
                }}
                className="sab-input-field"
                placeholder="https://images.unsplash.com/..."
              />
            </div>

            <div className="sab-field-group">
              <label>Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="sab-input-field"
              >
                <option value="Speaking Tips">Speaking Tips</option>
                <option value="Reading Passages">Reading Passages</option>
                <option value="Writing Assessor">Writing Assessor</option>
                <option value="General Guidance">General Guidance</option>
              </select>
            </div>

            <div className="sab-field-group">
              <label>Author Name</label>
              <input
                type="text"
                value={formData.author_name}
                onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                className="sab-input-field"
              />
            </div>

            <div className="sab-field-group">
              <label>Est. Read Time (Minutes)</label>
              <input
                type="number"
                min="1"
                value={formData.read_time_minutes}
                onChange={(e) => setFormData({ ...formData, read_time_minutes: parseInt(e.target.value) || 5 })}
                className="sab-input-field"
              />
            </div>

            <div className="sab-publish-switch-group">
              <div className="sab-publish-label">
                <strong>Publish Status</strong>
                <span>{formData.is_published ? "Live on public site" : "Saved as draft"}</span>
              </div>
              <input
                type="checkbox"
                checked={formData.is_published}
                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                style={{ width: "20px", height: "20px", accentColor: "#e11d2e", cursor: "pointer" }}
              />
            </div>

            {/* SEO Metadata Sub-card */}
            <div className="sab-seo-card">
              <h3>SEO &amp; Social Meta Tags</h3>
              <div className="sab-field-group">
                <label>SEO Title Tag</label>
                <input
                  type="text"
                  value={formData.meta_title || ""}
                  onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                  className="sab-input-field"
                  placeholder="Article Title | IELTS LMS"
                />
              </div>

              <div className="sab-field-group">
                <label>Tags (Comma separated)</label>
                <input
                  type="text"
                  value={formData.tags || ""}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="sab-input-field"
                  placeholder="IELTS, Preparation, Speaking"
                />
              </div>

              <div className="sab-field-group">
                <label>SEO Meta Description</label>
                <textarea
                  rows={2}
                  value={formData.meta_description || ""}
                  onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                  className="sab-input-field sab-textarea-field"
                  placeholder="Search engine meta description..."
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
