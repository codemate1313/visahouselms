import { Link } from "react-router-dom";
import type { GradingQueueItem } from "@/api/types";
import { Icon } from "@/components/icons";
import { gradingQueueStrings as strings } from "../GradingQueue.strings";

const STATUS_CLASS: Record<string, string> = { pending: "badge-amber", claimed: "badge-blue", completed: "badge-green" };

interface GradingQueueTableProps {
  items: GradingQueueItem[];
  gradingBase: string;
}

export function GradingQueueTable({ items, gradingBase }: GradingQueueTableProps) {
  const t = strings.table;
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t.student}</th>
            <th>{t.course}</th>
            <th>{t.queue}</th>
            <th>{t.owner}</th>
            <th>{t.due}</th>
            <th>{t.flags}</th>
            <th>{t.partsLeft}</th>
            <th className="table-actions-heading">{t.actions}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="clickable">
              <td>{item.student_name}</td>
              <td>
                {item.module_title}
                {item.is_reevaluation && <span className="badge badge-red">{t.reevaluationBadge}</span>}
              </td>
              <td><span className={`badge ${STATUS_CLASS[item.queue.status] ?? "badge-gray"}`}>{item.queue.status}</span></td>
              <td>{item.queue.assigned_to_name ?? t.unclaimed}</td>
              <td>{item.queue.due_at ? new Date(item.queue.due_at).toLocaleDateString() : "—"}</td>
              <td>{item.flag_count > 0 ? <span className="badge badge-red">{item.flag_count}</span> : "—"}</td>
              <td>{item.parts_to_grade}</td>
              <td className="table-actions">
                <Link to={`${gradingBase}/${item.id}`} aria-label={t.gradeSubmission} data-tooltip={t.gradeSubmission}>
                  <Icon name="grading" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
