import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
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
  moduleId: number;
  samplePartId: number;
  onChange: (examiner: SpeakingExaminer) => void;
}

interface ExaminerSamplePayload {
  audio_url: string;
}

/** The module's examiner, chosen once. Every speaking prompt in the module is
    rehearsed in this voice, so the choice lives here rather than on each
    question form - re-picking a voice per question (or per speaking part) was
    both repetitive and a way to end up with four different examiners in one
    module. */
export function SpeakingExaminerPicker({ examinerId, moduleId, samplePartId, onChange }: SpeakingExaminerPickerProps) {
  const t = strings.examinerPicker;
  const [examiners, setExaminers] = useState<SpeakingExaminer[]>([]);
  const [sampleLoadingId, setSampleLoadingId] = useState<string | null>(null);
  const [samplePlayingId, setSamplePlayingId] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  const examinerIdRef = useRef(examinerId);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  if (examiners.length === 0) return null;

  const examiner = examiners.find((item) => item.id === examinerId) ?? examiners[0];

  async function playSample(next: SpeakingExaminer) {
    audioRef.current?.pause();
    setSampleLoadingId(next.id);
    setSamplePlayingId(null);
    setSampleError(null);
    try {
      const { data } = await apiClient.post<ExaminerSamplePayload>(
        `/instructor/modules/${moduleId}/parts/${samplePartId}/speaking-avatar-preview`,
        { prompt: t.samplePrompt(next.name), examiner_id: next.id },
      );
      const audio = new Audio(`${API_BASE_URL}${data.audio_url}`);
      audioRef.current = audio;
      audio.onended = () => setSamplePlayingId(null);
      audio.onpause = () => setSamplePlayingId(null);
      await audio.play();
      setSamplePlayingId(next.id);
    } catch (err: unknown) {
      setSampleError(extractErrorMessage(err, t.sampleError));
    } finally {
      setSampleLoadingId(null);
    }
  }

  function chooseAndPlay(next: SpeakingExaminer) {
    onChange(next);
    void playSample(next);
  }

  function toggleSample(next: SpeakingExaminer) {
    if (samplePlayingId === next.id) {
      audioRef.current?.pause();
      setSamplePlayingId(null);
      return;
    }
    void playSample(next);
  }

  return (
    <section className="vh-examiner-picker">
      <div className="vh-examiner-picker-portrait">
        <div className="vh-avatar-preview-frame">
          <ExaminerAvatarSvg gender={examiner.gender} viseme={0} isPlaying={samplePlayingId === examiner.id} />
        </div>
      </div>
      <div className="vh-examiner-picker-copy">
        <p className="vh-examiner-picker-title">{t.title}</p>
        <p className={`vh-examiner-picker-hint${sampleError ? " is-error" : ""}`}>
          {sampleError ?? `${examiner.name} · ${examiner.accent}`}
        </p>
      </div>
      <SearchableSelect
        ariaLabel={t.label}
        className="vh-examiner-picker-select"
        options={examiners.map((item) => ({ value: item.id, label: `${item.name} (${item.accent})` }))}
        value={examiner.id}
        onChange={(value) => {
          const next = examiners.find((item) => item.id === String(value));
          if (next) chooseAndPlay(next);
        }}
        searchable={false}
      />
      <button
        type="button"
        className="vh-examiner-sample-button"
        onClick={() => toggleSample(examiner)}
        disabled={sampleLoadingId === examiner.id}
        aria-label={t.playSample(examiner.name)}
      >
        <Icon name={samplePlayingId === examiner.id ? "pause" : "play"} />
        <span>{sampleLoadingId === examiner.id ? t.preparingSample : t.sample}</span>
      </button>
    </section>
  );
}
