import { useEffect, useRef } from "react";
import type { ExamModulePart } from "@/api/types";
import { Icon } from "@/components/icons";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface ModulePartNavProps {
  parts: ExamModulePart[] | undefined;
  selectedPartId: number | null;
  onChoosePart: (part: ExamModulePart | null) => void;
}

/** Part titles double as candidate instructions, so they can be a whole
 *  paragraph. The stepper shows "Part N" for anything that will not fit on a
 *  single chip and keeps the full text in the tooltip. */
function shortLabel(part: ExamModulePart, index: number) {
  const title = part.title?.trim() ?? "";
  return title && title.length <= 22 ? title : `Part ${index + 1}`;
}

function isPartComplete(part: ExamModulePart) {
  return part.question_limit
    ? part.questions.length >= part.question_limit
    : part.questions.length > 0;
}

export function ModulePartNav({ parts, selectedPartId, onChoosePart }: ModulePartNavProps) {
  const t = strings.partNav;
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the selected step visible when the list scrolls sideways.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedPartId]);

  return (
    <nav className="module-part-stepper" aria-label={t.heading}>
      <div className="mps-track" role="tablist" aria-label={t.heading}>
        <button
          type="button"
          role="tab"
          aria-selected={selectedPartId === null}
          ref={selectedPartId === null ? activeRef : undefined}
          className={`mps-step mps-step-settings ${selectedPartId === null ? "is-active" : ""}`}
          onClick={() => onChoosePart(null)}
          title="Title, duration & candidate instructions"
        >
          <span className="mps-badge">
            <Icon name="settings" className="mps-badge-icon" />
          </span>
          <span className="mps-text">
            <span className="mps-title">Test Settings</span>
            <span className="mps-meta">Title & duration</span>
          </span>
        </button>

        {parts?.map((part, index) => {
          const complete = isPartComplete(part);
          const active = part.id === selectedPartId;
          const previous = index === 0 ? null : parts[index - 1];
          return (
            <div className="mps-node" key={part.id}>
              <span
                className={`mps-connector ${previous ? (isPartComplete(previous) ? "is-filled" : "") : "is-filled"}`}
                aria-hidden="true"
              >
                <i />
              </span>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                ref={active ? activeRef : undefined}
                className={`mps-step ${active ? "is-active" : ""} ${complete ? "is-complete" : ""}`}
                onClick={() => onChoosePart(part)}
                title={`${part.title} — ${part.section_type} · ${part.auto_marked ? t.autoMarked : t.examinerMarked} · ${part.ai_evaluation_enabled ? t.aiEnabled : t.manualOnly}`}
              >
                <span className="mps-badge">
                  {complete && !active
                    ? <Icon name="check" className="mps-badge-icon" />
                    : <span className="mps-num">{index + 1}</span>}
                </span>
                <span className="mps-text">
                  <span className="mps-title">{shortLabel(part, index)}</span>
                  <span className="mps-meta">
                    {part.question_limit
                      ? `${part.questions.length}/${part.question_limit} questions`
                      : `${part.questions.length} questions`}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
