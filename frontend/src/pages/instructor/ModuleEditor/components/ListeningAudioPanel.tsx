import { useEffect, type FormEvent } from "react";
import { RequiredMark } from "@/components/ui";
import { API_BASE_URL } from "@/api/client";
import type { ExamModuleAsset, ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface ListeningAudioPanelProps {
  part: ExamModulePart;
  isEditable: boolean;
  audioMode: "single" | "per_question";
  onAudioModeChange: (mode: "single" | "per_question") => void;
  audioTitle: string;
  onAudioTitleChange: (value: string) => void;
  onAudioFileChange: (file: File | null) => void;
  onUploadAudio: (event: FormEvent) => void;
  tts: { title: string; conversation: string; rate: string };
  onTtsChange: (tts: { title: string; conversation: string; rate: string }) => void;
  detectedTtsSpeakers: string[];
  onGenerateAudio: (payload: { title: string; conversation: string; rate: string }) => void;
  busy: boolean;
  audioFile: File | null;
  onDeleteAudio: (assetId: number) => void;
}

export function ListeningAudioPanel(props: ListeningAudioPanelProps) {
  const {
    part,
    isEditable,
    audioMode,
    onAudioModeChange,
    audioTitle,
    onAudioTitleChange,
    onAudioFileChange,
    onUploadAudio,
    busy,
    audioFile,
    onDeleteAudio,
  } = props;
  const t = strings.listeningAudio;

  useEffect(() => {
    if (audioMode !== "single") {
      onAudioModeChange("single");
    }
  }, [audioMode, onAudioModeChange]);

  return (
    <section className="listening-audio-panel vh-simple-audio-panel">
      {/* 1. Single Clean Header Bar: Title on Left */}
      <div className="vh-simple-audio-header">
        <div>
          <h2 className="vh-simple-audio-title">Audio for {part.title}</h2>
          <p className="vh-simple-audio-sub">
            1 Single continuous audio file for the entire part
          </p>
        </div>
      </div>

      {/* 2. Simple Uploader Form */}
      {isEditable && (
        <div className="vh-simple-uploader-box">
          <form onSubmit={onUploadAudio} className="vh-simple-form-stack">
            <div className="vh-simple-input-group">
              <label htmlFor="audio-title">
                Audio title
                <RequiredMark />
              </label>
              <input
                id="audio-title"
                value={audioTitle}
                placeholder="Listening audio"
                onChange={(event) => onAudioTitleChange(event.target.value)}
                required
              />
            </div>

            <div className="vh-simple-input-group">
              <label htmlFor="audio-file">
                MP3 file
                <RequiredMark />
              </label>
              <input
                key={part.id + (audioFile ? "-loaded" : "-empty")}
                id="audio-file"
                type="file"
                accept=".mp3,audio/mpeg"
                onChange={(event) => onAudioFileChange(event.target.files?.[0] ?? null)}
                required
              />
            </div>

            {audioFile && (
              <div className="audio-preview-container" style={{ margin: "4px 0" }}>
                <audio controls src={URL.createObjectURL(audioFile)} style={{ width: "100%", height: "36px" }} />
              </div>
            )}

            <div className="vh-simple-form-submit">
              <button type="submit" disabled={busy || !audioFile} className="vh-simple-submit-btn">
                {busy ? t.working : "Attach MP3 to this part"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. Existing Audio Assets List */}
      <div className="part-audio-list" style={{ marginTop: "14px" }}>
        {!part.assets.length ? (
          <p className="empty-message" style={{ margin: 0, fontSize: "12.5px" }}>{t.noAudio}</p>
        ) : (
          part.assets
            .filter((asset: ExamModuleAsset) => asset.asset_type !== "tts_text")
            .map((asset: ExamModuleAsset) => (
              <article key={asset.id} style={{ padding: "10px 14px" }}>
                <div>
                  <strong>{asset.title}</strong>
                  <small>
                    {asset.asset_type === "tts_mp3"
                      ? t.legacyGeneratedVoice(asset.tts_voice ?? "")
                      : asset.original_filename}
                  </small>
                </div>
                {asset.url ? (
                  <audio controls preload="metadata" src={`${API_BASE_URL}${asset.url}`} style={{ height: "34px" }}>
                    Your browser does not support audio.
                  </audio>
                ) : null}
                {asset.transcript && (
                  <details>
                    <summary>{t.transcript}</summary>
                    <p>{asset.transcript}</p>
                  </details>
                )}
                {isEditable && (
                  <button className="danger-text" onClick={() => onDeleteAudio(asset.id)}>
                    {t.delete}
                  </button>
                )}
              </article>
            ))
        )}
      </div>
    </section>
  );
}
