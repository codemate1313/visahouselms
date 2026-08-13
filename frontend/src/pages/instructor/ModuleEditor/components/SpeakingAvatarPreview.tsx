import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Icon } from "@/components/icons";
import { ExaminerAvatarSvg } from "@/components/speaking/ExaminerAvatarSvg";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { DEFAULT_EXAMINER_ID, type SpeakingExaminer } from "./SpeakingExaminerPicker";
import "./SpeakingAvatarPreview.css";

interface VisemeFrame {
  time: number;
  viseme: number;
}

interface PreviewPayload {
  examiner: SpeakingExaminer;
  prompt_text: string;
  audio_url: string;
  duration: number;
  visemes: VisemeFrame[];
}

interface SpeakingAvatarPreviewProps {
  moduleId: number;
  partId: number;
  prompt: string;
  /** Chosen once for the module by SpeakingExaminerPicker; null until the
      examiner roster has loaded, when the server default is used. */
  examiner: SpeakingExaminer | null;
}

/** Authoring-side rehearsal of a speaking prompt: the same examiner voice and
    viseme timeline the candidate gets, so the author can hear the question
    before it is saved rather than discovering a mangled prompt in a live sitting. */
export function SpeakingAvatarPreview({ moduleId, partId, prompt, examiner }: SpeakingAvatarPreviewProps) {
  const t = strings.avatarPreview;
  const examinerId = examiner?.id ?? DEFAULT_EXAMINER_ID;
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [previewedPrompt, setPreviewedPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentViseme, setCurrentViseme] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const frameRef = useRef<number | null>(null);

  const trimmedPrompt = prompt.trim();
  const isStale = Boolean(payload) && previewedPrompt !== trimmedPrompt;

  // A voice change makes the generated audio wrong, so drop it and let the
  // author play the prompt again in the newly chosen examiner's voice.
  useEffect(() => {
    audioRef.current?.pause();
    setPayload(null);
    setPreviewedPrompt("");
  }, [examinerId]);

  // Mouth shapes follow audio playback position, matching the exam runner.
  useEffect(() => {
    if (!isPlaying || !payload?.visemes.length) {
      setCurrentViseme(0);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      return;
    }
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused) {
        setCurrentViseme(0);
        setIsPlaying(false);
        return;
      }
      let active = 0;
      for (const frame of payload.visemes) {
        if (audio.currentTime < frame.time) break;
        active = frame.viseme;
      }
      setCurrentViseme(active);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [isPlaying, payload]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function generatePreview() {
    if (!trimmedPrompt) return;
    audioRef.current?.pause();
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.post<PreviewPayload>(
        `/instructor/modules/${moduleId}/parts/${partId}/speaking-avatar-preview`,
        { prompt: trimmedPrompt, examiner_id: examinerId },
      );
      setPayload(data);
      setPreviewedPrompt(trimmedPrompt);
      // Playing needs the new <audio src>, which only exists after this render.
      requestAnimationFrame(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.currentTime = 0;
        audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });
    } catch (err: unknown) {
      setPayload(null);
      setError(extractErrorMessage(err, t.error));
    } finally {
      setLoading(false);
    }
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio || !payload) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    audio.currentTime = 0;
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }

  const canPlay = Boolean(payload) && !isStale;

  return (
    <div className="vh-avatar-preview-card">
      <div className="vh-avatar-preview-header">
        <span className="vh-avatar-preview-title">{t.title}</span>
      </div>

      <div className="vh-avatar-preview-body">
        <div className={`vh-avatar-preview-portrait${isPlaying ? " is-speaking" : ""}`}>
          <div className="vh-avatar-preview-frame">
            <ExaminerAvatarSvg gender={examiner?.gender} viseme={currentViseme} isPlaying={isPlaying} />
          </div>
        </div>

        <div className="vh-avatar-preview-info">
          <p className="vh-avatar-preview-name">
            {examiner ? `${examiner.name} - ${examiner.title}` : t.defaultExaminer}
          </p>
          <p className="vh-avatar-preview-prompt">{trimmedPrompt}</p>
          <p className={`vh-avatar-preview-status${error ? " is-error" : ""}`}>
            {error
              ? error
              : loading
                ? t.generating
                : isPlaying
                  ? t.speaking
                  : isStale
                    ? t.stale
                    : canPlay
                      ? t.ready
                      : t.hint}
          </p>

          <div className="vh-avatar-preview-actions">
            <button
              type="button"
              className="vh-avatar-preview-button"
              onClick={canPlay ? togglePlay : generatePreview}
              disabled={loading || !trimmedPrompt}
            >
              <Icon name={isPlaying ? "x" : "play"} />
              {loading ? t.generating : isPlaying ? t.stop : canPlay ? t.replay : t.generate}
            </button>
            {canPlay && !isPlaying && (
              <button
                type="button"
                className="vh-avatar-preview-button is-ghost"
                onClick={generatePreview}
                disabled={loading}
              >
                {t.regenerate}
              </button>
            )}
          </div>
        </div>
      </div>

      {payload && (
        <audio
          ref={audioRef}
          src={`${API_BASE_URL}${payload.audio_url}`}
          onEnded={() => { setIsPlaying(false); setCurrentViseme(0); }}
          onPause={() => setIsPlaying(false)}
          preload="auto"
        />
      )}
    </div>
  );
}
