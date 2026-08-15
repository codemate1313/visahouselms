import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { ExaminerAvatarSvg } from "@/components/speaking/ExaminerAvatarSvg";
import { PhotoExaminerAvatar } from "@/components/speaking/PhotoExaminerAvatar";
import { getExaminerPhotoSet } from "@/components/speaking/examinerPhotoSets";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { SONIA_EXAMINER, type SpeakingExaminer } from "../speakingExaminer";
import "./SpeakingAvatarPreview.css";

interface SpeakingExaminerPickerProps {
  moduleId: number;
  samplePartId: number;
}

interface ExaminerSamplePayload {
  audio_url: string;
}

/** Sonia is the single examiner used throughout authoring and candidate
    delivery. The strip remains a voice preview, not an examiner selector. */
export function SpeakingExaminerPicker({ moduleId, samplePartId }: SpeakingExaminerPickerProps) {
  const t = strings.examinerPicker;
  const [sampleLoadingId, setSampleLoadingId] = useState<string | null>(null);
  const [samplePlayingId, setSamplePlayingId] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const examiner = SONIA_EXAMINER;
  const photoSet = getExaminerPhotoSet(examiner.id);

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
      <div className={`vh-examiner-picker-portrait${samplePlayingId === examiner.id ? " is-speaking" : ""}`}>
        <div className="vh-avatar-preview-frame">
          {photoSet ? (
            <PhotoExaminerAvatar
              set={photoSet}
              audioRef={audioRef}
              isPlaying={samplePlayingId === examiner.id}
            />
          ) : (
            <ExaminerAvatarSvg gender={examiner.gender} viseme={0} isPlaying={samplePlayingId === examiner.id} />
          )}
        </div>
      </div>
      <div className="vh-examiner-picker-copy">
        <p className="vh-examiner-picker-title">{t.title}</p>
        <p className={`vh-examiner-picker-hint${sampleError ? " is-error" : ""}`}>
          {sampleError ?? `${examiner.name} · ${examiner.accent}`}
        </p>
      </div>
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
