import type { ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface ModulePartNavProps {
  parts: ExamModulePart[] | undefined;
  selectedPartId: number | null;
  onChoosePart: (part: ExamModulePart) => void;
}

export function ModulePartNav({ parts, selectedPartId, onChoosePart }: ModulePartNavProps) {
  const t = strings.partNav;
  return (
    <aside className="module-part-nav" aria-label={t.heading}>
      <h2>{t.heading}</h2>
      <p>{t.hint}</p>
      <div className="module-part-list">
        {parts?.map((part) => (
          <button className={part.id === selectedPartId ? "active" : ""} onClick={() => onChoosePart(part)} key={part.id}>
            <span>
              <strong>{part.title}</strong>
              <small>
                {part.section_type} · {part.auto_marked ? t.autoMarked : t.examinerMarked} · {part.ai_evaluation_enabled ? t.aiEnabled : t.manualOnly}
              </small>
            </span>
            <span>
              {part.question_limit ? `${part.questions.length} pool / ${part.question_limit} draw` : `${part.questions.length}+`}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
