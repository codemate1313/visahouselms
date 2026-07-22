import { useEffect, useState } from "react";

import { apiClient } from "../../api/client";
import type { Announcement } from "../../api/types";
import { CollapsiblePanel } from "../../components/CollapsiblePanel";

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
      .catch(() => setError("Announcements could not be loaded."));
  }, []);

  return (
    <div className="student-announcements-page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Notifications</span>
          <h1>Announcements</h1>
        </div>
      </div>
      {error && <p className="error-text">{error}</p>}
      <CollapsiblePanel
        className="workspace-panel student-announcements-panel"
        title="Announcement inbox"
        description="Read platform and institute announcements."
        badge={<span className="count-chip">{announcements.length}</span>}
      >
        {announcements.length === 0 && (
          <div className="empty-state">
            <h2>No announcements yet</h2>
          </div>
        )}
        <div className="announcement-history-list">
          {announcements.map((item) => (
            <article key={item.id}>
              <div>
                <span className="badge badge-green">{item.institute_id == null ? "Platform" : "Institute"}</span>
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
