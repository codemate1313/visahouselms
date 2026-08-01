import { Link } from "react-router-dom";
import type { GradingQueueItem } from "@/api/types";
import { Icon } from "@/components/icons";
import { useAuthStore } from "@/store/authStore";
import { gradingQueueStrings as strings } from "../GradingQueue.strings";

const STATUS_CLASS: Record<string, string> = { pending: "badge-amber", claimed: "badge-blue", completed: "badge-green" };

interface GradingQueueTableProps {
  items: GradingQueueItem[];
  gradingBase: string;
}

export function GradingQueueTable({ items, gradingBase }: GradingQueueTableProps) {
  const t = strings.table;
  const userId = useAuthStore((state) => state.user?.id);

  const today: GradingQueueItem[] = [];
  const yesterday: GradingQueueItem[] = [];
  const older: GradingQueueItem[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  items.forEach((item) => {
    if (!item.submitted_at) {
      older.push(item);
      return;
    }
    const date = new Date(item.submitted_at).getTime();
    if (date >= todayStart) {
      today.push(item);
    } else if (date >= yesterdayStart) {
      yesterday.push(item);
    } else {
      older.push(item);
    }
  });

  const formatDateTime = (val: string | null | undefined) => {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const renderRow = (item: GradingQueueItem) => {
    const claimedByOther =
      item.queue.status === "claimed" &&
      item.queue.assigned_to_id != null &&
      item.queue.assigned_to_id !== userId;
    const claimedByMe =
      item.queue.status === "claimed" &&
      item.queue.assigned_to_id === userId;

    const issuedAt = item.submitted_at || item.queue.created_at;

    return (
      <tr key={item.id} className={claimedByOther ? "" : "clickable"}>
        <td>{item.student_name}</td>
        <td>
          {item.module_title}
          {item.is_reevaluation && <span className="badge badge-red">{t.reevaluationBadge}</span>}
        </td>
        <td><span className={`badge ${STATUS_CLASS[item.queue.status] ?? "badge-gray"}`}>{item.queue.status}</span></td>
        <td>
          {claimedByMe
            ? t.youAreGrading
            : claimedByOther
              ? t.gradingBy(item.queue.assigned_to_name ?? t.anotherInstructor)
              : t.unclaimed}
        </td>
        <td>{formatDateTime(issuedAt)}</td>
        <td>{item.queue.due_at ? new Date(item.queue.due_at).toLocaleDateString() : "—"}</td>
        <td>{item.flag_count > 0 ? <span className="badge badge-red">{item.flag_count}</span> : "—"}</td>
        <td>{item.parts_to_grade}</td>
        <td className="table-actions">
          {claimedByOther ? (
            <span
              className="badge badge-blue"
              data-tooltip={t.evaluatingBy(item.queue.assigned_to_name ?? t.anotherInstructor)}
            >
              <Icon name="lock" />
              {t.gradingNow}
            </span>
          ) : (
            <Link to={`${gradingBase}/${item.id}`} aria-label={t.gradeSubmission} data-tooltip={t.gradeSubmission}>
              <Icon name="grading" />
            </Link>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t.student}</th>
            <th>{t.course}</th>
            <th>{t.queue}</th>
            <th>{t.owner}</th>
            <th>{t.issued}</th>
            <th>{t.due}</th>
            <th>{t.flags}</th>
            <th>{t.partsLeft}</th>
            <th className="table-actions-heading">{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {today.length > 0 && (
            <>
              <tr className="table-group-header">
                <td colSpan={9}>Today</td>
              </tr>
              {today.map(renderRow)}
            </>
          )}
          {yesterday.length > 0 && (
            <>
              <tr className="table-group-header">
                <td colSpan={9}>Yesterday</td>
              </tr>
              {yesterday.map(renderRow)}
            </>
          )}
          {older.length > 0 && (
            <>
              <tr className="table-group-header">
                <td colSpan={9}>Older Submissions</td>
              </tr>
              {older.map(renderRow)}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}

