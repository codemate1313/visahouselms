import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/api/client";
import { SearchableSelect } from "@/components/ui";
import { ExaminerAvatarSvg } from "@/components/speaking/ExaminerAvatarSvg";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import "./SpeakingAvatarPreview.css";

export interface SpeakingExaminer {
  id: string;
  name: string;
  title: string;
  gender: string;
  accent: string;
}

export const DEFAULT_EXAMINER_ID = "sonia";

interface SpeakingExaminerPickerProps {
  /** Currently chosen examiner id, so a stored choice survives a reload. */
  examinerId: string;
  onChange: (examiner: SpeakingExaminer) => void;
}

/** The module's examiner, chosen once. Every speaking prompt in the module is
    rehearsed in this voice, so the choice lives here rather than on each
    question form - re-picking a voice per question (or per speaking part) was
    both repetitive and a way to end up with four different examiners in one
    module. */
export function SpeakingExaminerPicker({ examinerId, onChange }: SpeakingExaminerPickerProps) {
  const t = strings.examinerPicker;
  const [examiners, setExaminers] = useState<SpeakingExaminer[]>([]);
  const onChangeRef = useRef(onChange);
  const examinerIdRef = useRef(examinerId);

  useEffect(() => {
    onChangeRef.current = onChange;
    examinerIdRef.current = examinerId;
  });

  // The roster is fixed, so it is fetched once for the whole module rather
  // than once per question form.
  useEffect(() => {
    let active = true;
    apiClient
      .get<SpeakingExaminer[]>("/instructor/modules/speaking-examiners")
      .then(({ data }) => {
        if (!active) return;
        setExaminers(data);
        // Resolve the stored id into a full profile so the previews can show
        // the examiner's name and face before any audio is generated.
        const chosen = data.find((item) => item.id === examinerIdRef.current) ?? data[0];
        if (chosen) onChangeRef.current(chosen);
      })
      .catch(() => { /* Previews fall back to the default examiner voice. */ });
    return () => { active = false; };
  }, []);

  if (examiners.length === 0) return null;

  const examiner = examiners.find((item) => item.id === examinerId) ?? examiners[0];

  return (
    <section className="vh-examiner-picker">
      <div className="vh-examiner-picker-portrait">
        <div className="vh-avatar-preview-frame">
          <ExaminerAvatarSvg gender={examiner.gender} viseme={0} isPlaying={false} />
        </div>
      </div>
      <div className="vh-examiner-picker-copy">
        <p className="vh-examiner-picker-title">{t.title}</p>
        <p className="vh-examiner-picker-hint">{t.hint}</p>
      </div>
      <SearchableSelect
        ariaLabel={t.label}
        className="vh-examiner-picker-select"
        options={examiners.map((item) => ({ value: item.id, label: `${item.name} (${item.accent})` }))}
        value={examiner.id}
        onChange={(value) => {
          const next = examiners.find((item) => item.id === String(value));
          if (next) onChange(next);
        }}
        searchable={false}
      />
    </section>
  );
}
