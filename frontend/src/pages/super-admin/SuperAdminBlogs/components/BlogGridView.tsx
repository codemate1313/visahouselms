import { Link } from "react-router-dom";
import { superAdminBlogsStrings as strings } from "../SuperAdminBlogs.strings";
import type { BlogAdminItem } from "../types";
import { StatusToggleIcon } from "./StatusToggleIcon";
import { formatDate } from "@/utils/date";
import { IconButton } from "@/components/ui/IconButton/IconButton";

interface BlogGridViewProps {
  items: BlogAdminItem[];
  onToggleActive: (item: BlogAdminItem) => void;
  onDelete: (id: number) => void;
}

export function BlogGridView({ items, onToggleActive, onDelete }: BlogGridViewProps) {
  return (
    <div className="sab-grid-view">
      {items.map((item) => (
        <div key={item.id} className={`sab-card ${!item.is_published ? "inactive" : ""}`}>
          <div className="sab-card-cover">
            {item.featured_image_url ? (
              <img src={item.featured_image_url} alt={item.title} className="sab-card-cover-img" />
            ) : (
              <div className="sab-card-cover-placeholder">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}
            <span className="sab-card-category-badge">{item.category}</span>
            <div className="sab-card-cover-actions">
              <IconButton
                className="sab-cover-action-btn"
                data-sab-tooltip={item.is_published ? strings.unpublishTooltip : strings.publishTooltip}
                onClick={() => onToggleActive(item)}
                icon={<StatusToggleIcon isPublished={item.is_published} />}
                label={item.is_published ? strings.unpublishTooltip : strings.publishTooltip}
                showTooltip={false}
              />
              <Link to={`/super-admin/blogs/${item.id}`} className="sab-cover-action-btn edit" data-sab-tooltip={strings.editTooltip}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </Link>
              <IconButton
                className="sab-cover-action-btn delete"
                data-sab-tooltip={strings.deleteTooltip}
                onClick={() => onDelete(item.id)}
                variant="danger"
                label={strings.deleteTooltip}
                showTooltip={false}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                }
              />
            </div>
          </div>

          <div className="sab-card-body">
            <h3 className="sab-card-title" title={item.title}>{item.title}</h3>
            <div className="sab-card-slug">/{item.slug}</div>
            <div className="sab-card-author-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="sab-author-name">{item.author_name}</span>
              <span className="sab-dot">•</span>
              <span className="sab-read-time">
                {item.read_time_minutes} {strings.minReadSuffix}
              </span>
            </div>
          </div>

          <div className="sab-card-footer">
            <span className={`sab-status-pill ${item.is_published ? "published" : "draft"}`}>
              <span className="dot"></span> {item.is_published ? strings.publishedLabel : strings.draftLabel}
            </span>
            <span className="sab-card-date">{formatDate(item.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
