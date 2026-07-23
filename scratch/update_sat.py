import re

with open('/Users/dummy/Desktop/Visahouselms/frontend/src/pages/superadmin/SuperAdminTestimonials.tsx', 'r') as f:
    content = f.read()

# We need to replace the Table view and Grid view action buttons.
# Let's focus on the table view first.
table_view_search = """        <div className="sat-table-wrapper">
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
        </div>"""

table_view_replace = """        <div className="sat-table-wrapper">
          <table className="sat-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>SCORE</th>
                <th>QUOTE</th>
                <th>STATUS</th>
                <th>ORDER</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className={!item.is_active ? "inactive-row" : ""}>
                  <td>
                    <div className="sat-table-student">
                      {item.avatar_url ? (
                         <img src={item.avatar_url} alt="" className="sat-avatar-img" />
                      ) : (
                         <div className="sat-avatar-placeholder">{item.student_name.charAt(0).toUpperCase()}</div>
                      )}
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
                    <span className={`sat-status-badge ${item.is_active ? "active" : "inactive"}`}>
                      <span className="dot"></span> {item.is_active ? "Active" : "Draft"}
                    </span>
                  </td>
                  <td><span className="sat-order-badge">{item.display_order}</span></td>
                  <td>
                    <div className="sat-table-actions">
                      <div 
                        className={`sat-switch ${item.is_active ? "active" : ""}`}
                        onClick={() => handleToggleActive(item)}
                        title={item.is_active ? "Deactivate" : "Activate"}
                      >
                        <div className="sat-switch-handle">
                           {item.is_active && (
                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                               <polyline points="20 6 9 17 4 12"></polyline>
                             </svg>
                           )}
                        </div>
                      </div>
                      
                      <button onClick={() => { setEditingItem(item); setIsModalOpen(true); }} className="sat-icon-btn edit-btn" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      
                      <button onClick={() => handleDelete(item.id)} className="sat-icon-btn delete-btn" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>"""

if table_view_search in content:
    content = content.replace(table_view_search, table_view_replace)
    with open('/Users/dummy/Desktop/Visahouselms/frontend/src/pages/superadmin/SuperAdminTestimonials.tsx', 'w') as f:
        f.write(content)
    print("Updated table successfully.")
else:
    print("Could not find table to update.")
