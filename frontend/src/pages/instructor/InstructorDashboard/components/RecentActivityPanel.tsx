import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";

interface ActivityItem {
  action: string;
  entity_type: string;
  entity_id: number | null;
  created_at: string | null;
}

interface RecentActivityPanelProps {
  activity: ActivityItem[];
}

function actionLabel(action: string): string {
  const value = action.split(".").pop() ?? action;
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function RecentActivityPanel({ activity }: RecentActivityPanelProps) {
  const t = strings.recentActivity;
  return (
    <section className="workspace-panel">
      <div className="panel-heading">
        <div>
          <h2>{t.title}</h2>
          <p>{t.description}</p>
        </div>
      </div>
      {activity.length ? (
        <ul className="activity-list">
          {activity.map((item, index) => (
            <li key={`${item.action}-${index}`}>
              <span>{actionLabel(item.action)}</span>
              <time>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</time>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
    </section>
  );
}
