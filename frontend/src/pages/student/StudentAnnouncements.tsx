import { useEffect, useState } from "react";

import { apiClient } from "@/api/client";
import type { Announcement } from "@/api/types";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { PageHeader } from "@/components/ui";
import { studentAnnouncementsStrings as strings } from "./StudentAnnouncements.strings";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "";
}

export function StudentAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<Announcement[]>("/student/announcements")
      .then(({ data }) => {
        setAnnouncements(data);
        setError(null);
      })
      .catch(() => setError(strings.loadError));
  }, []);

  return (
    <div className="student-announcements-page">
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} />
      {error && <p className="error-text">{error}</p>}
      <CollapsiblePanel
        className="workspace-panel student-announcements-panel"
        title={strings.panelTitle}
        description={strings.panelDescription}
        badge={<span className="count-chip">{announcements.length}</span>}
      >
        {announcements.length === 0 && (
          <div className="empty-state">
            <h2>{strings.empty}</h2>
          </div>
        )}
        <div className="announcement-history-list">
          {announcements.map((item) => (
            <article key={item.id}>
              <div>
                <span className="badge badge-green">{item.institute_id == null ? strings.platform : strings.institute}</span>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                <small>{formatDate(item.published_at)}</small>
              </div>
            </article>
          ))}
        </div>
      </CollapsiblePanel>
    </div>
  );
}
