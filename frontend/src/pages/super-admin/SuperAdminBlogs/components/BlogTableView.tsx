import { Link } from "react-router-dom";
import { superAdminBlogsStrings as strings } from "../SuperAdminBlogs.strings";
import type { BlogAdminItem } from "../types";
import { StatusToggleIcon } from "./StatusToggleIcon";

interface BlogTableViewProps {
  items: BlogAdminItem[];
  onToggleActive: (item: BlogAdminItem) => void;
  onDelete: (id: number) => void;
}

export function BlogTableView({ items, onToggleActive, onDelete }: BlogTableViewProps) {
  const t = strings.tableHeaders;
  return (
    <div className="sab-table-wrapper">
      <table className="sab-table">
        <thead>
          <tr>
            <th>{t.article}</th>
            <th>{t.author}</th>
            <th>{t.status}</th>
            <th style={{ textAlign: "right" }}>{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={!item.is_published ? "inactive-row" : ""}>
              <td>
                <div className="sab-table-article">
                  {item.featured_image_url ? (
                    <img src={item.featured_image_url} alt={item.title} className="sab-table-thumb" />
                  ) : (
                    <div className="sab-table-thumb-placeholder">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}
                  <div className="sab-table-article-info">
                    <span className="sab-table-article-title" title={item.title}>{item.title}</span>
                    <div className="sab-table-article-meta">
                      <span className="sab-cat-pill">{item.category}</span>
                      <span className="sab-slug-pill">/{item.slug}</span>
                      <span className="sab-read-pill">
                        {item.read_time_minutes} {strings.minReadSuffix}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td>
                <div className="sab-table-author-cell">
                  <span className="sab-author-name">{item.author_name}</span>
                </div>
              </td>
              <td>
                <span className={`sab-status-pill ${item.is_published ? "published" : "draft"}`}>
                  <span className="dot"></span> {item.is_published ? strings.publishedLabel : strings.draftLabel}
                </span>
              </td>
              <td>
                <div className="sab-table-actions">
                  <button
                    type="button"
                    className="sab-action-btn-icon"
                    data-sab-tooltip={item.is_published ? strings.unpublishTooltip : strings.publishTooltip}
                    onClick={() => onToggleActive(item)}
                  >
                    <StatusToggleIcon isPublished={item.is_published} />
                  </button>
                  <Link to={`/super-admin/blogs/${item.id}`} className="sab-action-btn-icon edit" data-sab-tooltip={strings.editTooltip}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </Link>
                  <button type="button" className="sab-action-btn-icon delete" data-sab-tooltip={strings.deleteTooltip} onClick={() => onDelete(item.id)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
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
  );
}
