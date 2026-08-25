import { instructorDashboardStrings as strings } from "../InstructorDashboard.strings";
import { Icon, type IconName } from "@/components/icons";

interface ActivityItem {
  action: string;
  entity_type: string;
  entity_id: number | null;
  created_at: string | null;
}

interface RecentActivityPanelProps {
  activity: ActivityItem[];
}

function getActivityIcon(action: string): IconName {
  const act = action.split(".").pop()?.toLowerCase() ?? "";
  if (act.includes("delete") || act.includes("remove")) return "trash";
  if (act.includes("create") || act.includes("add")) return "plus";
  if (act.includes("update") || act.includes("edit") || act.includes("status")) return "edit";
  if (act.includes("import") || act.includes("upload")) return "download";
  return "history";
}

function getActivityClass(action: string): string {
  const act = action.split(".").pop()?.toLowerCase() ?? "";
  if (act.includes("delete") || act.includes("remove")) return "delete";
  if (act.includes("create") || act.includes("add")) return "create";
  if (act.includes("update") || act.includes("edit") || act.includes("status")) return "update";
  if (act.includes("import") || act.includes("upload")) return "import";
  return "update";
}

function formatActivity(action: string, entityType: string, entityId: number | null): string {
  const act = (action.split(".").pop() ?? action).toLowerCase().trim();
  const ent = entityType.toLowerCase().trim();
  
  if (act === "create") {
    return `Created ${ent}${entityId ? ` #${entityId}` : ""}`;
  }
  if (act === "delete") {
    return `Deleted ${ent}${entityId ? ` #${entityId}` : ""}`;
  }
  if (act === "update") {
    return `Updated ${ent}${entityId ? ` #${entityId}` : ""}`;
  }
  if (act === "import_all") {
    return `Imported all ${ent}`;
  }
  if (act === "status") {
    return `Changed ${ent} status`;
  }
  if (act === "grade") {
    return `Graded student attempt${entityId ? ` #${entityId}` : ""}`;
  }
  if (act === "login") {
    return `Logged into the platform`;
  }
  
  const humanAction = act.replaceAll("_", " ");
  const humanEntity = ent.replaceAll("_", " ");
  return `${humanAction.charAt(0).toUpperCase() + humanAction.slice(1)} ${humanEntity}${entityId ? ` #${entityId}` : ""}`;
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
              <div className={`activity-icon-wrapper ${getActivityClass(item.action)}`}>
                <Icon name={getActivityIcon(item.action)} style={{ width: 14, height: 14 }} />
              </div>
              <div className="activity-info">
                <span>{formatActivity(item.action, item.entity_type, item.entity_id)}</span>
                <time>{item.created_at ? new Date(item.created_at).toLocaleString() : "—"}</time>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
    </section>
  );
}
