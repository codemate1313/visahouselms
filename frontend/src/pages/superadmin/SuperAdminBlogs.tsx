import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "../../api/client";
import "./SuperAdminBlogs.css";

interface BlogAdminItem {
  id: number;
  title: string;
  slug: string;
  category: string;
  author_name: string;
  read_time_minutes: number;
  is_published: boolean;
  featured_image_url?: string;
  created_at: string;
}

export function SuperAdminBlogs() {
  const [items, setItems] = useState<BlogAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const fetchItems = () => {
    setLoading(true);
    apiClient.get("/super-admin/blogs")
      .then((res) => {
        setItems(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleDelete = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this blog post?")) return;
    apiClient.delete(`/super-admin/blogs/${id}`).then(() => {
      fetchItems();
    });
  };

  const handleToggleActive = (item: BlogAdminItem) => {
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

  const totalCount = items.length;
  const publishedCount = items.filter((i) => i.is_published).length;
  const draftCount = items.filter((i) => !i.is_published).length;

  return (
    <div className="sab-container">
      {/* Top Banner Header */}
      <div className="sab-header">
        <div className="sab-header-info">
          <div className="sab-header-title-row">
            <span className="sab-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            <h1>CMS Educational Blogs Management</h1>
            <span className="sab-badge sab-badge-total">{totalCount} Total</span>
          </div>
          <p>Publish, edit, or manage educational IELTS preparation articles and SEO content.</p>
        </div>

        <div className="sab-header-actions">
          <Link to="/super-admin/blogs/new" className="sab-btn sab-btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Write New Blog Post</span>
          </Link>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="sab-metrics-grid">
        <div className="sab-metric-card">
          <div className="sab-metric-data">
            <span className="sab-metric-label">Total Articles</span>
            <span className="sab-metric-value">{totalCount}</span>
          </div>
        </div>

        <div className="sab-metric-card">
          <div className="sab-metric-data">
            <span className="sab-metric-label">Published</span>
            <span className="sab-metric-value sab-text-green">{publishedCount}</span>
          </div>
        </div>

        <div className="sab-metric-card">
          <div className="sab-metric-data">
            <span className="sab-metric-label">Draft / Inactive</span>
            <span className="sab-metric-value sab-text-yellow">{draftCount}</span>
          </div>
        </div>

        <div className="sab-metric-card">
          <div className="sab-metric-data">
            <span className="sab-metric-label">Platform Health</span>
            <span className="sab-metric-value sab-text-red">Optimal</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="sab-toolbar">
        <div className="sab-search-box">
          <svg className="sab-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by title, category, or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sab-search-input"
          />
        </div>

        <div className="sab-toolbar-actions">
          <div className="sab-filter-group">
            {(["ALL", "PUBLISHED", "DRAFT"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`sab-filter-btn ${filterStatus === st ? "active" : ""}`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="sab-view-group">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`sab-view-btn ${viewMode === "grid" ? "active" : ""}`}
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
              className={`sab-view-btn ${viewMode === "table" ? "active" : ""}`}
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

      {loading ? (
        <div className="sab-loading">
          <div className="sab-spinner"></div>
          <p>Loading blogs...</p>
        </div>
      ) : filteredItems.length === 0 ? null : viewMode === "grid" ? (
        <div className="sab-grid-view">
          {filteredItems.map((item) => (
            <div key={item.id} className={`sab-card ${!item.is_published ? "inactive" : ""}`}>
              <div className="sab-card-header">
                {item.featured_image_url ? (
                  <img src={item.featured_image_url} alt={item.title} className="sab-card-avatar" style={{ borderRadius: '8px', width: '50px', height: '50px', objectFit: 'cover' }} />
                ) : (
                  <div className="sab-card-avatar" style={{ backgroundColor: '#f1f5f9', borderRadius: '8px', width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </div>
                )}
                <div className="sab-card-meta">
                  <h3 className="sab-card-name" title={item.title}>{item.title}</h3>
                  <p className="sab-card-role">{item.category} • {item.read_time_minutes} min read</p>
                </div>
                <div className="sab-card-actions">
                  <button type="button" className="sab-action-btn" data-tooltip="Toggle Publish Status" onClick={() => handleToggleActive(item)}>
                    {item.is_published ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="sab-text-green">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="sab-text-yellow">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                  <Link to={`/super-admin/blogs/${item.id}`} className="sab-action-btn edit" data-tooltip="Edit Article">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </Link>
                  <button type="button" className="sab-action-btn delete" data-tooltip="Delete Article" onClick={() => handleDelete(item.id)}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="sab-card-body">
                <p className="sab-card-quote">
                  "/{item.slug}" <br/>
                  <span style={{color: 'var(--text-muted)', fontSize: '0.8rem'}}>{item.author_name}</span>
                </p>
                <div className="sab-card-footer">
                  <span className={`sab-badge ${item.is_published ? "sab-badge-active" : "sab-badge-inactive"}`}>
                    {item.is_published ? "Published" : "Draft"}
                  </span>
                  <span className="sab-card-date">{new Date(item.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="sab-table-view">
          <table className="sab-table">
            <thead>
              <tr>
                <th>Title &amp; Info</th>
                <th>Author</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={!item.is_published ? "inactive-row" : ""}>
                  <td>
                    <div className="sab-table-student">
                      {item.featured_image_url ? (
                        <img src={item.featured_image_url} alt={item.title} className="sab-table-avatar" style={{ width: '64px', height: '48px', borderRadius: '6px', objectFit: 'cover' }} />
                      ) : (
                        <div className="sab-table-avatar" style={{ width: '64px', height: '48px', backgroundColor: '#f1f5f9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                        </div>
                      )}
                      <div className="sab-table-student-info">
                        <strong>{item.title}</strong>
                        <span>{item.category} • /{item.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="sab-table-score">{item.author_name}</span>
                  </td>
                  <td>
                    <span className={`sab-badge ${item.is_published ? "sab-badge-active" : "sab-badge-inactive"}`}>
                      {item.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td>
                    <div className="sab-table-actions">
                      <button type="button" className="sab-action-btn" data-tooltip="Toggle Status" onClick={() => handleToggleActive(item)}>
                        {item.is_published ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sab-text-green">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="sab-text-yellow">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                      <Link to={`/super-admin/blogs/${item.id}`} className="sab-action-btn edit" data-tooltip="Edit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </Link>
                      <button type="button" className="sab-action-btn delete" data-tooltip="Delete" onClick={() => handleDelete(item.id)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
