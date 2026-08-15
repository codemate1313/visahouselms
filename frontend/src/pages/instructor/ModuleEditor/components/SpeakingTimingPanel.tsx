import { type FormEvent, useEffect, useState } from "react";
import type { ExamModulePart } from "@/api/types";
import { Button } from "@/components/ui";
import { CollapsiblePanel } from "@/components/CollapsiblePanel";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { MinuteSecondInput } from "./MinuteSecondInput";

interface SpeakingTimingPanelProps {
  part: ExamModulePart;
  isEditable: boolean;
  busy: boolean;
  onSave: (preparationSeconds: number, responseSeconds: number) => Promise<void>;
}

export function SpeakingTimingPanel({ part, isEditable, busy, onSave }: SpeakingTimingPanelProps) {
  const [preparationSeconds, setPreparationSeconds] = useState(part.answer_constraints.preparation_seconds ?? 5);
  const [responseSeconds, setResponseSeconds] = useState(part.answer_constraints.response_seconds ?? 60);
  const t = strings.speakingTiming;

  useEffect(() => {
    setPreparationSeconds(part.answer_constraints.preparation_seconds ?? 5);
    setResponseSeconds(part.answer_constraints.response_seconds ?? 60);
  }, [part.id, part.answer_constraints.preparation_seconds, part.answer_constraints.response_seconds]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void onSave(preparationSeconds, responseSeconds);
  };

  return (
    <form className="form-card wide speaking-timing-card" onSubmit={submit}>
      <CollapsiblePanel title={t.heading(part.title)} description={t.description} eyebrow={t.eyebrow}>
        <div className="speaking-timing-fields">
          <MinuteSecondInput
            id={`preparation-${part.id}`}
            label={t.preparationLabel}
            minSeconds={0}
            maxSeconds={600}
            value={preparationSeconds}
            onChange={setPreparationSeconds}
            required
            readOnly={!isEditable}
          />
          <MinuteSecondInput
            id={`response-${part.id}`}
            label={t.responseLabel}
            minSeconds={5}
            maxSeconds={1800}
            value={responseSeconds}
            onChange={setResponseSeconds}
            required
            readOnly={!isEditable}
          />
        </div>
        <p className="field-hint">{t.hint}</p>
        {isEditable && <Button type="submit" disabled={busy}>{busy ? t.saving : t.save}</Button>}
      </CollapsiblePanel>
    </form>
  );
}
