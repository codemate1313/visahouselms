import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { StudentBadge } from "@/api/types";
import { studentProgressStrings as strings } from "../StudentProgress.strings";
import { formatDate } from "@/utils/date";
import { Badge3DEmblem } from "./Badge3DEmblem";

interface BadgesPanelProps {
  badges: StudentBadge[];
  earnedCount: number;
}

export function BadgesPanel({ badges, earnedCount }: BadgesPanelProps) {
  const t = strings.badges;
  return (
    <CollapsiblePanel
      className="progress-section"
      title={t.title}
      description={t.description}
      badge={
        <span className="count-chip">
          {earnedCount} / {badges.length}
        </span>
      }
    >
      <div className="achievement-grid">
        {badges.map((badge) => (
          <article key={badge.code} className={`badge-card-3d ${badge.earned ? "is-earned" : "is-locked"}`}>
            <Badge3DEmblem code={badge.code} earned={badge.earned} />
            <div className="badge-card-details">
              <div className="badge-card-status-row">
                <span className="badge-card-status">
                  {badge.earned ? "✓ Earned" : "🔒 Locked"}
                </span>
                {badge.awarded_at && <time className="badge-card-time">{formatDate(badge.awarded_at)}</time>}
              </div>
              <h3 className="badge-card-title">{badge.name}</h3>
              <p className="badge-card-desc">{badge.description}</p>
            </div>
          </article>
        ))}
      </div>
    </CollapsiblePanel>
  );
}

