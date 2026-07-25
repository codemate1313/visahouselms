import { Icon } from "@/components/icons";
import type { Announcement } from "@/api/types";
import { formatDate } from "../helpers";
import { historyStatusTabs, platformNotificationsStrings as strings } from "../PlatformNotifications.strings";
import type { HistoryStatusFilter } from "../types";

interface NotificationHistoryProps {
  announcements: Announcement[];
  filteredAnnouncements: Announcement[];
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: HistoryStatusFilter;
  onStatusFilterChange: (filter: HistoryStatusFilter) => void;
  onDelete: (id: number) => void;
}

export function NotificationHistory({
  announcements,
  filteredAnnouncements,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onDelete,
}: NotificationHistoryProps) {
  const t = strings.history;
  const activeTabIdx = historyStatusTabs.indexOf(statusFilter);

  return (
    <div className="pn-card pn-history-card">
      <div className="pn-card-header">
        <div>
          <h2 className="pn-card-title">{t.title}</h2>
          <p className="pn-card-subtitle">{t.subtitle}</p>
        </div>
        <span className="pn-history-count">{announcements.length}</span>
      </div>

      <div className="pn-history-toolbar">
        <div className="pn-search-wrap">
          <Icon name="search" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pn-history-search"
          />
        </div>
        <div className="apple-segmented-control">
          <div
            className="apple-segmented-thumb"
            style={{
              width: "calc((100% - 4px) / 4)",
              transform: `translateX(calc(${activeTabIdx} * 100%))`,
            }}
          />
          {historyStatusTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onStatusFilterChange(tab)}
              className={`apple-segmented-tab ${statusFilter === tab ? "is-active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="pn-history-list">
        {filteredAnnouncements.length === 0 ? (
          <div className="pn-empty-state">
            <Icon name="notifications" />
            <p>{t.emptyMessage}</p>
          </div>
        ) : (
          filteredAnnouncements.map((item) => (
            <article key={item.id} className="pn-history-item">
              <div className="pn-history-item-top">
                <span className={`pn-badge badge-${item.status}`}>{item.status}</span>
                <span className="pn-history-date">
                  {item.status === "scheduled" && item.scheduled_at
                    ? `${t.scheduledPrefix}: ${formatDate(item.scheduled_at)}`
                    : `${t.publishedPrefix}: ${formatDate(item.published_at)}`}
                </span>
              </div>

              <h3 className="pn-history-item-title">{item.title}</h3>
              <p className="pn-history-item-body">{item.message}</p>

              <div className="pn-history-item-bottom">
                <span className="pn-audience-tag">
                  {t.audiencePrefix}: {item.audience}
                </span>
                <button type="button" className="pn-delete-btn" onClick={() => onDelete(item.id)} title={t.deleteTitle}>
                  <Icon name="trash" />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
