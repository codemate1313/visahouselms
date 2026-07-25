import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { Icon, type IconName } from "@/components/icons";
import type { StudentBadge } from "@/api/types";
import { studentProgressStrings as strings } from "../StudentProgress.strings";

const BADGE_ICONS: Record<string, IconName> = {
  flag: "grading",
  compass: "analytics",
  spark: "overview",
  crown: "products",
  grid: "overview",
  target: "due",
  streak: "analytics",
};

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
          <article key={badge.code} className={badge.earned ? "is-earned" : "is-locked"}>
            <div className="achievement-icon">
              <Icon name={BADGE_ICONS[badge.icon] ?? "grading"} />
            </div>
            <div>
              <span>{badge.earned ? t.earned : t.locked}</span>
              <h3>{badge.name}</h3>
              <p>{badge.description}</p>
              {badge.awarded_at && <time>{new Date(badge.awarded_at).toLocaleDateString()}</time>}
            </div>
          </article>
        ))}
      </div>
    </CollapsiblePanel>
  );
}
