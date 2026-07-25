import { Button } from "@/components/ui";
import type { Assessment } from "@/api/types";
import { testEditorStrings as strings } from "../TestEditor.strings";

interface TestStatusBarProps {
  test: Assessment;
  isOwner: boolean;
  onChangeStatus: (status: Assessment["status"]) => void;
}

export function TestStatusBar({ test, isOwner, onChangeStatus }: TestStatusBarProps) {
  const t = strings.statusBar;
  return (
    <div className="course-status-bar">
      <div>
        <span className={`badge badge-${test.status === "published" ? "green" : test.status === "draft" ? "amber" : "gray"}`}>{test.status}</span>
        <span>{t.summary(test.question_count, test.total_points, test.duration_minutes)}</span>
      </div>
      {isOwner && (
        <div className="status-actions">
          {test.status !== "draft" && (
            <Button variant="secondary" size="sm" onClick={() => onChangeStatus("draft")}>
              {t.moveToDraft}
            </Button>
          )}
          {test.status === "draft" && (
            <Button size="sm" onClick={() => onChangeStatus("published")}>
              {t.publish}
            </Button>
          )}
          {test.status !== "archived" && (
            <Button variant="secondary" size="sm" onClick={() => onChangeStatus("archived")}>
              {t.archive}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
