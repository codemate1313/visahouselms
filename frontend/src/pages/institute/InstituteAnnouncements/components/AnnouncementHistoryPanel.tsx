import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { Announcement } from "@/api/types";
import { formatDate } from "../helpers";
import { instituteAnnouncementsStrings as strings } from "../InstituteAnnouncements.strings";

interface AnnouncementHistoryPanelProps {
  announcements: Announcement[];
}

export function AnnouncementHistoryPanel({ announcements }: AnnouncementHistoryPanelProps) {
  const t = strings.history;
  return (
    <CollapsiblePanel
      className="workspace-panel announcement-history-panel"
      title={t.title}
      description={t.description}
      badge={<span className="count-chip">{announcements.length}</span>}
    >
      <div className="announcement-history-list">
        {announcements.length === 0 && (
          <div className="announcement-empty-state">
            <strong>{t.emptyTitle}</strong>
            <span>{t.emptyDescription}</span>
          </div>
        )}
        {announcements.map((item) => (
          <article key={item.id}>
            <div>
              <span className={`badge ${item.status === "published" ? "badge-green" : item.status === "scheduled" ? "badge-purple" : "badge-gray"}`}>{item.status}</span>
              <h3>{item.title}</h3>
              <p>{item.message}</p>
              <small>
                {t.audiencePrefix}: {item.audience}
                {item.status === "scheduled" && item.scheduled_at
                  ? ` · ${t.scheduledForPrefix}: ${formatDate(item.scheduled_at)}`
                  : ` · ${t.publishedPrefix}: ${formatDate(item.published_at)}`}
              </small>
            </div>
          </article>
        ))}
      </div>
    </CollapsiblePanel>
  );
}
