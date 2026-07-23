import re

with open('/Users/dummy/Desktop/Visahouselms/frontend/src/pages/superadmin/SuperAdminTestimonials.css', 'r') as f:
    content = f.read()

# Replace Table View part
css_to_replace = """/* Table View */
.sat-table-wrapper {
  background: var(--glass-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow-x: auto;
  box-shadow: var(--shadow-sm);
}
.sat-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.sat-table th {
  background: var(--surface-muted);
  padding: 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-muted);
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--border);
}
.sat-table td {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.sat-table tr:last-child td {
  border-bottom: none;
}
.sat-table tr:hover {
  background: var(--surface-muted);
}
.sat-table tr.inactive-row {
  opacity: 0.7;
}

.sat-table-student {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.sat-table-student img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
.sat-table-name {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text);
}
.sat-table-role {
  font-size: 0.75rem;
  color: var(--text-muted);
}
.sat-table-score {
  font-size: 0.875rem;
  font-weight: 700;
  background: var(--surface-muted);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text);
}
.sat-table-quote {
  font-size: 0.875rem;
  color: var(--text-muted);
  font-style: italic;
  max-width: 300px;
}
.sat-table-actions .sat-action-btn {
  font-size: 0.75rem;
  font-weight: 600;
  text-decoration: underline;
}"""

new_css = """/* Table View */
.sat-table-wrapper {
  background: #ffffff;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  overflow-x: auto;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}
.sat-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}
.sat-table th {
  background: #f9fafb;
  padding: 1.25rem 1.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #6b7280;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e5e7eb;
}
.sat-table td {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
  background: #ffffff;
}
.sat-table tr:last-child td {
  border-bottom: none;
}
.sat-table tr.inactive-row {
  opacity: 0.8;
  background: #fafafa;
}

.sat-table-student {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.sat-avatar-img {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  object-fit: cover;
}
.sat-avatar-placeholder {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #8b5cf6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  font-weight: 600;
}
.sat-table-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #111827;
}
.sat-table-role {
  font-size: 0.75rem;
  color: #6b7280;
}
.sat-table-score {
  font-size: 0.875rem;
  color: #374151;
}
.sat-table-quote {
  font-size: 0.875rem;
  color: #6b7280;
  max-width: 300px;
}

.sat-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.sat-status-badge.active {
  background: #d1fae5;
  color: #059669;
}
.sat-status-badge.inactive {
  background: #f3f4f6;
  color: #6b7280;
}
.sat-status-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* Actions matching Screenshot */
.sat-table-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sat-switch {
  width: 56px;
  height: 32px;
  border-radius: 16px;
  background: #e5e7eb;
  position: relative;
  cursor: pointer;
  transition: background-color 0.3s;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
}
.sat-switch.active {
  background: #10b981;
}
.sat-switch-handle {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #ffffff;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.sat-switch.active .sat-switch-handle {
  transform: translateX(24px);
}

.sat-icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: transparent;
  transition: all 0.2s;
  flex-shrink: 0;
}
.sat-icon-btn.edit-btn {
  border: 1.5px solid #bfdbfe;
  color: #3b82f6;
}
.sat-icon-btn.edit-btn:hover {
  background: #eff6ff;
  border-color: #93c5fd;
}
.sat-icon-btn.delete-btn {
  border: 1.5px solid #fecaca;
  color: #ef4444;
}
.sat-icon-btn.delete-btn:hover {
  background: #fef2f2;
  border-color: #fca5a5;
}
"""

if css_to_replace in content:
    content = content.replace(css_to_replace, new_css)
    with open('/Users/dummy/Desktop/Visahouselms/frontend/src/pages/superadmin/SuperAdminTestimonials.css', 'w') as f:
        f.write(content)
    print("Updated CSS successfully.")
else:
    print("Could not find CSS block to replace.")
