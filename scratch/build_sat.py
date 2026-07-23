import re

def process_file():
    with open('/Users/dummy/Desktop/Visahouselms/scratch_SuperAdminTestimonials.tsx', 'r') as f:
        content = f.read()
    
    # We will just write a new file from scratch in the python script.
    # We can preserve the state/hooks section.
    
    # The hooks section ends exactly at `return (`
    parts = content.split('  return (', 1)
    if len(parts) != 2:
        return
        
    logic_part = parts[0]
    
    # We will inject the CSS import at the top
    logic_part = logic_part.replace('import { apiClient } from "../../api/client";', 
                                    'import { apiClient } from "../../api/client";\nimport "./SuperAdminTestimonials.css";')

    new_jsx = """  return (
    <div className="sat-container">
      {/* Top Banner Header */}
      <div className="sat-header">
        <div className="sat-header-info">
          <div className="sat-header-title-row">
            <span className="sat-icon-box">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <h1>Student Testimonials Management</h1>
            <span className="sat-badge sat-badge-total">{totalCount} Total</span>
          </div>
          <p>Create, order, and toggle verified student reviews shown on the public landing page.</p>
        </div>

        <div className="sat-header-actions">
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
            className="sat-btn sat-btn-primary"
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
      <div className="sat-metrics-grid">
        <div className="sat-metric-card">
          <div className="sat-metric-icon sat-icon-blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="sat-metric-data">
            <span className="sat-metric-label">Total Items</span>
            <span className="sat-metric-value">{totalCount}</span>
          </div>
        </div>

        <div className="sat-metric-card">
          <div className="sat-metric-icon sat-icon-green">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div className="sat-metric-data">
            <span className="sat-metric-label">Active Published</span>
            <span className="sat-metric-value sat-text-green">{activeCount}</span>
          </div>
        </div>

        <div className="sat-metric-card">
          <div className="sat-metric-icon sat-icon-yellow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="sat-metric-data">
            <span className="sat-metric-label">Draft / Inactive</span>
            <span className="sat-metric-value sat-text-yellow">{inactiveCount}</span>
          </div>
        </div>

        <div className="sat-metric-card">
          <div className="sat-metric-icon sat-icon-red">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="sat-metric-data">
            <span className="sat-metric-label">Avg Student Score</span>
            <span className="sat-metric-value sat-text-red">Band 8.0+</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="sat-toolbar">
        <div className="sat-search-box">
          <svg className="sat-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, role, score or quote..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sat-search-input"
          />
        </div>

        <div className="sat-toolbar-actions">
          <div className="sat-filter-group">
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`sat-filter-btn ${filterStatus === st ? "active" : ""}`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="sat-view-group">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`sat-view-btn ${viewMode === "grid" ? "active" : ""}`}
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
              className={`sat-view-btn ${viewMode === "table" ? "active" : ""}`}
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
        <div className="sat-loading">
          <div className="sat-spinner"></div>
          <p>Loading testimonials...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="sat-empty">
          <div className="sat-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h3>No testimonials found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="sat-grid-view">
          {filteredItems.map((item) => (
            <div key={item.id} className={`sat-card ${!item.is_active ? "inactive" : ""}`}>
              <div className="sat-card-header">
                <img src={item.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(item.student_name)} alt={item.student_name} className="sat-card-avatar" />
                <div className="sat-card-meta">
                  <h3 className="sat-card-name">{item.student_name}</h3>
                  <div className="sat-card-role">{item.student_role}</div>
                </div>
                <div className="sat-card-actions">
                  <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="sat-action-btn edit" title="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="sat-action-btn delete" title="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="sat-card-body">
                <div className="sat-card-rating">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < item.rating ? "#f59e0b" : "none"} stroke={i < item.rating ? "#f59e0b" : "#cbd5e1"} strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                  {item.target_score && <span className="sat-card-score">{item.target_score}</span>}
                </div>
                <p className="sat-card-quote">"{item.quote}"</p>
              </div>
              <div className="sat-card-footer">
                <button
                  onClick={() => handleToggleActive(item)}
                  className={`sat-toggle-btn ${item.is_active ? "active" : ""}`}
                >
                  {item.is_active ? (
                    <><span className="dot on"></span> Published</>
                  ) : (
                    <><span className="dot off"></span> Draft</>
                  )}
                </button>
                <span className="sat-order-badge">Order: {item.display_order}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="sat-table-wrapper">
          <table className="sat-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Score</th>
                <th>Quote</th>
                <th>Status</th>
                <th>Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={!item.is_active ? "inactive-row" : ""}>
                  <td>
                    <div className="sat-table-student">
                      <img src={item.avatar_url || "https://ui-avatars.com/api/?name=" + encodeURIComponent(item.student_name)} alt="" />
                      <div>
                        <div className="sat-table-name">{item.student_name}</div>
                        <div className="sat-table-role">{item.student_role}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="sat-table-score">{item.target_score || "-"}</span></td>
                  <td>
                    <div className="sat-table-quote" title={item.quote}>
                      "{item.quote.length > 60 ? item.quote.substring(0, 60) + "..." : item.quote}"
                    </div>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`sat-toggle-btn small ${item.is_active ? "active" : ""}`}
                    >
                      {item.is_active ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td><span className="sat-order-badge">{item.display_order}</span></td>
                  <td>
                    <div className="sat-table-actions">
                      <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="sat-action-btn edit">Edit</button>
                      <button onClick={() => handleDelete(item.id)} className="sat-action-btn delete">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for Add / Edit */}
      {isModalOpen && editingItem && (
        <div className="sat-modal-backdrop">
          <div className="sat-modal">
            <div className="sat-modal-header">
              <h2>{editingItem.id ? "Edit Testimonial" : "Add New Testimonial"}</h2>
              <button type="button" className="sat-modal-close" onClick={() => setIsModalOpen(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="sat-modal-body">
              <form id="testimonial-form" onSubmit={handleSave}>
                <div className="sat-form-grid">
                  <div className="sat-form-group">
                    <label>Student Name *</label>
                    <input
                      type="text"
                      required
                      value={editingItem.student_name || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, student_name: e.target.value })}
                      className="sat-input"
                      placeholder="e.g. Ananya Sharma"
                    />
                  </div>
                  <div className="sat-form-group">
                    <label>Target Score</label>
                    <input
                      type="text"
                      value={editingItem.target_score || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, target_score: e.target.value })}
                      className="sat-input"
                      placeholder="e.g. Achieved Band 8.0"
                    />
                  </div>
                  <div className="sat-form-group full-width">
                    <label>Student Role / Context</label>
                    <input
                      type="text"
                      value={editingItem.student_role || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, student_role: e.target.value })}
                      className="sat-input"
                      placeholder="e.g. Academic Candidate"
                    />
                  </div>
                  <div className="sat-form-group">
                    <label>Avatar Image URL</label>
                    <input
                      type="url"
                      value={editingItem.avatar_url || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, avatar_url: e.target.value })}
                      className="sat-input"
                      placeholder="https://example.com/photo.jpg"
                    />
                  </div>
                  <div className="sat-form-group">
                    <label>Rating (1-5)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={editingItem.rating || 5}
                      onChange={(e) => setEditingItem({ ...editingItem, rating: parseInt(e.target.value) })}
                      className="sat-input"
                    />
                  </div>
                  <div className="sat-form-group full-width">
                    <label>Quote *</label>
                    <textarea
                      required
                      rows={4}
                      value={editingItem.quote || ""}
                      onChange={(e) => setEditingItem({ ...editingItem, quote: e.target.value })}
                      className="sat-input sat-textarea"
                      placeholder="Student's testimonial text..."
                    ></textarea>
                  </div>
                  <div className="sat-form-group">
                    <label>Display Order</label>
                    <input
                      type="number"
                      value={editingItem.display_order || 0}
                      onChange={(e) => setEditingItem({ ...editingItem, display_order: parseInt(e.target.value) })}
                      className="sat-input"
                    />
                  </div>
                  <div className="sat-form-group sat-checkbox-group">
                    <label className="sat-checkbox-label">
                      <input
                        type="checkbox"
                        checked={editingItem.is_active || false}
                        onChange={(e) => setEditingItem({ ...editingItem, is_active: e.target.checked })}
                      />
                      <span>Publish immediately (Active)</span>
                    </label>
                  </div>
                </div>
              </form>
            </div>
            <div className="sat-modal-footer">
              <button type="button" onClick={() => setIsModalOpen(false)} className="sat-btn sat-btn-secondary">
                Cancel
              </button>
              <button type="submit" form="testimonial-form" disabled={saving} className="sat-btn sat-btn-primary">
                {saving ? "Saving..." : "Save Testimonial"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""

    with open('/Users/dummy/Desktop/Visahouselms/frontend/src/pages/superadmin/SuperAdminTestimonials.tsx', 'w') as f:
        f.write(logic_part + new_jsx)

process_file()
