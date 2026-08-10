import { useEffect, useState } from "react";
import type { ExamModulePart } from "@/api/types";
import { Button } from "@/components/ui";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface SharedPassagePanelProps {
  part: ExamModulePart;
  isEditable: boolean;
  busy: boolean;
  onSave: (passage: string) => void;
}

/**
 * One source text for the whole part.
 *
 * The passage is stored per question in the data model, and validation requires
 * every question in a shared-passage part to carry a byte-identical copy. Asking
 * an author to paste the same text into five questions is both tedious and the
 * most likely way to fail that check, so the part owns the passage here and
 * writes it down to every question on save.
 */
export function SharedPassagePanel({ part, isEditable, busy, onSave }: SharedPassagePanelProps) {
  const t = strings.sharedPassage;
  const saved = part.questions[0]?.passage ?? "";
  const [draft, setDraft] = useState(saved);

  // Re-sync when the part changes or the module reloads after a save.
  useEffect(() => setDraft(saved), [saved, part.id]);

  const dirty = draft.trim() !== saved.trim();
  const mismatched = part.questions.some(
    (question) => (question.passage ?? "").trim() !== saved.trim(),
  );

  return (
    <section className="authoring-panel shared-passage-panel">
      <div className="panel-title">
        <div>
          <span className="phase-chip">{t.eyebrow}</span>
          <h2>{t.heading(part.title)}</h2>
          <p>{t.description}</p>
        </div>
      </div>

      <textarea
        className="shared-passage-input"
        rows={12}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t.placeholder}
        readOnly={!isEditable}
        aria-label={t.heading(part.title)}
      />

      <div className="shared-passage-footer">
        <span className="shared-passage-status">
          {mismatched
            ? t.statusMismatch
            : part.questions.length === 0
            ? t.statusNoQuestions
            : t.statusApplied(part.questions.length)}
        </span>
        {isEditable && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !draft.trim() || (!dirty && !mismatched)}
            onClick={() => onSave(draft)}
          >
            {busy ? t.saving : t.save}
          </Button>
        )}
      </div>
    </section>
  );
}
