import type { FormEvent } from "react";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import { API_BASE_URL } from "@/api/client";
import type { ExamModuleAsset, ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface ListeningAudioPanelProps {
  part: ExamModulePart;
  isEditable: boolean;
  audioTitle: string;
  onAudioTitleChange: (value: string) => void;
  onAudioFileChange: (file: File | null) => void;
  onUploadAudio: (event: FormEvent) => void;
  tts: { title: string; conversation: string; rate: string };
  onTtsChange: (tts: { title: string; conversation: string; rate: string }) => void;
  detectedTtsSpeakers: string[];
  onGenerateAudio: (event: FormEvent) => void;
  busy: boolean;
  audioFile: File | null;
  onDeleteAudio: (assetId: number) => void;
}

export function ListeningAudioPanel({
  part,
  isEditable,
  audioTitle,
  onAudioTitleChange,
  onAudioFileChange,
  onUploadAudio,
  tts,
  onTtsChange,
  detectedTtsSpeakers,
  onGenerateAudio,
  busy,
  audioFile,
  onDeleteAudio,
}: ListeningAudioPanelProps) {
  const t = strings.listeningAudio;
  return (
    <section className="listening-audio-panel">
      <div className="panel-title">
        <div>
          <span className="phase-chip">{t.eyebrow}</span>
          <h2>{t.heading(part.title)}</h2>
          <p>{t.description}</p>
        </div>
      </div>
      {isEditable && (
        <div className="audio-method-grid">
          <form onSubmit={onUploadAudio}>
            <h3>{t.uploadHeading}</h3>
            <label htmlFor="audio-title">{t.audioTitleLabel}<RequiredMark /></label>
            <input id="audio-title" value={audioTitle} onChange={(event) => onAudioTitleChange(event.target.value)} required />
            <label htmlFor="audio-file">{t.fileLabel}<RequiredMark /></label>
            <input id="audio-file" type="file" accept=".mp3,audio/mpeg" onChange={(event) => onAudioFileChange(event.target.files?.[0] ?? null)} required />
            <button type="submit" disabled={busy || !audioFile}>
              {busy ? t.working : t.attach}
            </button>
          </form>
          <form onSubmit={onGenerateAudio}>
            <h3>{t.generateHeading}</h3>
            <label htmlFor="tts-title">{t.audioTitleLabel}<RequiredMark /></label>
            <input id="tts-title" value={tts.title} onChange={(event) => onTtsChange({ ...tts, title: event.target.value })} required />
            <label htmlFor="tts-conversation">{t.conversationLabel}<RequiredMark /></label>
            <textarea
              id="tts-conversation"
              rows={8}
              value={tts.conversation}
              onChange={(event) => onTtsChange({ ...tts, conversation: event.target.value })}
              placeholder={t.conversationPlaceholder}
              required
            />
            <p className="hint">
              {t.conversationHint}
              <strong>{t.speakerExampleA}</strong>
              {t.speakerExampleOr}
              <strong>{t.speakerExampleB}</strong>
              {t.conversationHintSuffix}
            </p>
            <div className={`auto-voice-summary${detectedTtsSpeakers.length > 6 ? " has-error" : ""}`}>
              <strong>{detectedTtsSpeakers.length ? t.speakersDetected(detectedTtsSpeakers.length) : t.waitingForConversation}</strong>
              <span>{detectedTtsSpeakers.length ? detectedTtsSpeakers.join(" · ") : t.voicesAutomatic}</span>
              {detectedTtsSpeakers.length > 6 && <small>{t.tooManySpeakers}</small>}
            </div>
            <label htmlFor="tts-rate">{t.rateLabel}</label>
            <SearchableSelect
              id="tts-rate"
              options={[
                { value: "-20%", label: t.rateSlower },
                { value: "+0%", label: t.rateNormal },
                { value: "+15%", label: t.rateFaster },
              ]}
              value={tts.rate}
              onChange={(value) => onTtsChange({ ...tts, rate: String(value) })}
              searchable={false}
              className="form-dropdown-select"
            />
            <button type="submit" disabled={busy || !tts.conversation.trim() || detectedTtsSpeakers.length > 6}>
              {busy ? t.generating : t.generateWith(detectedTtsSpeakers.length)}
            </button>
          </form>
        </div>
      )}
      <div className="part-audio-list">
        {!part.assets.length ? (
          <p className="empty-message">{t.noAudio}</p>
        ) : (
          part.assets.map((asset: ExamModuleAsset) => (
            <article key={asset.id}>
              <div>
                <strong>{asset.title}</strong>
                <small>{asset.asset_type === "tts_mp3" ? t.generatedVoice(asset.tts_voice ?? "") : asset.original_filename}</small>
              </div>
              <audio controls preload="metadata" src={`${API_BASE_URL}${asset.url}`}>
                Your browser does not support audio.
              </audio>
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
