import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import type { Assessment, Question } from "@/api/types";
import { testEditorStrings as strings } from "../TestEditor.strings";
import { Icon } from "@/components/icons";

interface TestOrderPanelProps {
  test: Assessment;
  questionIds: number[];
  byId: Map<number, Question>;
  canEdit: boolean;
  saving: boolean;
  onMoveQuestion: (index: number, direction: -1 | 1) => void;
  onRemoveQuestion: (questionId: number) => void;
  onSave: () => void;
}

export function TestOrderPanel({ test, questionIds, byId, canEdit, saving, onMoveQuestion, onRemoveQuestion, onSave }: TestOrderPanelProps) {
  const t = strings.testOrder;
  return (
    <CollapsiblePanel
      className="authoring-panel selected-questions-panel"
      title={t.heading}
      description={t.description}
      badge={<span className="count-chip">{questionIds.length}</span>}
    >
      {!questionIds.length ? (
        <p className="empty-message">{t.empty}</p>
      ) : (
        <ol className="test-order-list">
          {questionIds.map((questionId, index) => {
            const question = byId.get(questionId) ?? test.questions?.find((item) => item.id === questionId);
            return (
              <li key={questionId}>
                <div>
                  <strong>{question?.prompt ?? t.fallbackQuestion(questionId)}</strong>
                  <small>
                    {question?.section} · {question?.bank_title}
                  </small>
                </div>
                {canEdit && (
                  <div>
                    <button aria-label={t.moveUp} disabled={index === 0} onClick={() => onMoveQuestion(index, -1)}>
                      <Icon name="arrowUp" />
                    </button>
                    <button aria-label={t.moveDown} disabled={index === questionIds.length - 1} onClick={() => onMoveQuestion(index, 1)}>
                      <Icon name="arrowDown" />
                    </button>
                    <button aria-label={t.remove} className="danger-text" onClick={() => onRemoveQuestion(questionId)}>
                      <Icon name="cross" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {canEdit && (
        <button className="save-order-button" onClick={onSave} disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
      )}
    </CollapsiblePanel>
  );
}
