import { useState, useEffect, useRef, type FormEvent } from "react";
import { RequiredMark, SearchableSelect, Button } from "@/components/ui";
import { Icon } from "@/components/icons";
import { extractVoiceMetadata, stripVoiceMetadata, findVoiceByGender } from "@/components/listening/ListeningMediaAvatar";
import { API_BASE_URL } from "@/api/client";
import type { ExamModuleAsset, ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

function BrowserNarrationPreview({ asset }: { asset: ExamModuleAsset }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const speechSupported = typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

  const handlePlayStop = () => {
    if (!speechSupported) return;
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }
    
    const cleanTranscript = stripVoiceMetadata(asset.transcript || "");
    const voiceMetadata = extractVoiceMetadata(asset.transcript || "");
    const lines = cleanTranscript.split(/\n+/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    window.speechSynthesis.cancel();
    setIsPlaying(true);
    
    const voices = window.speechSynthesis.getVoices();
    const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("en"));
    const preferredLocale = (asset.tts_voice || "en-GB").toLowerCase();
    
    const percentage = Number.parseInt(asset.tts_rate ?? "0", 10);
    const rate = Math.min(1.5, Math.max(0.65, 1 + (Number.isFinite(percentage) ? percentage / 100 : 0)));
    
    // Determine speaker indexes to assign default alternate voices if "auto" is used
    const speakerIndexes = new Map<string, number>();
    
    let currentIndex = 0;
    const playNext = () => {
      if (currentIndex >= lines.length) {
        setIsPlaying(false);
        return;
      }
      const line = lines[currentIndex];
      const match = line.match(/^([^:]{1,40}):\s*(.+)$/);
      const speaker = match?.[1].trim() || "Narrator";
      const text = match?.[2].trim() || line;
      
      if (!speakerIndexes.has(speaker)) speakerIndexes.set(speaker, speakerIndexes.size);
      const speakerIndex = speakerIndexes.get(speaker) ?? 0;
      
      const roleGender = voiceMetadata[speaker] || "auto";
      
      const preferredVoices = englishVoices.filter((voice) => voice.lang.toLowerCase() === preferredLocale);
      const usableVoices = preferredVoices.length ? preferredVoices : englishVoices;
      
      const targetVoiceResult = roleGender === "auto" 
        ? { voice: (usableVoices[speakerIndex % Math.max(usableVoices.length, 1)] ?? null), pitch: 1.0 }
        : findVoiceByGender(englishVoices, preferredLocale, roleGender as any);

      const utterance = new SpeechSynthesisUtterance(text);
      if (targetVoiceResult.voice) utterance.voice = targetVoiceResult.voice;
      utterance.pitch = targetVoiceResult.pitch;
      utterance.rate = rate;
      utterance.onend = () => {
        currentIndex++;
        playNext();
      };
      utterance.onerror = () => {
        setIsPlaying(false);
      };
      window.speechSynthesis.speak(utterance);
    };
    
    playNext();
  };

  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
    };
  }, [speechSupported]);

  if (!speechSupported) return <p className="hint">Browser narration preview not supported in this browser.</p>;

  return (
    <div style={{ marginTop: "8px" }}>
      <Button 
        variant="secondary"
        onClick={handlePlayStop} 
        style={{ padding: "4px 12px", fontSize: "0.85rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
      >
        <Icon name={isPlaying ? "pause" : "play"} />
        {isPlaying ? "Stop Preview" : "Preview Narration"}
      </Button>
    </div>
  );
}

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
  onGenerateAudio: (payload: { title: string; conversation: string; rate: string }) => void;
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
  const existingTtsAsset = part.assets.find((a) => a.asset_type === "tts_text");
  
  const [activeMethod, setActiveMethod] = useState<"upload" | "tts">("upload");
  const [isEditingTts, setIsEditingTts] = useState(!existingTtsAsset);
  const [voiceChoices, setVoiceChoices] = useState<Record<string, "male" | "female" | "auto">>(() => {
    return existingTtsAsset ? extractVoiceMetadata(existingTtsAsset.transcript ?? "") : {};
  });

  const lastLoadedAssetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (existingTtsAsset && lastLoadedAssetIdRef.current !== existingTtsAsset.id) {
      lastLoadedAssetIdRef.current = existingTtsAsset.id;
      onTtsChange({
        title: existingTtsAsset.title || "Generated conversation",
        conversation: stripVoiceMetadata(existingTtsAsset.transcript || ""),
        rate: existingTtsAsset.tts_rate || "+0%",
      });
      setVoiceChoices(extractVoiceMetadata(existingTtsAsset.transcript ?? ""));
      setIsEditingTts(false);
      setActiveMethod("tts");
    } else if (!existingTtsAsset && lastLoadedAssetIdRef.current !== null) {
      // Asset was deleted
      lastLoadedAssetIdRef.current = null;
      setIsEditingTts(true);
      setVoiceChoices({});
    }
  }, [existingTtsAsset, onTtsChange]);

  const handleGenerateSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!tts.conversation.trim()) return;

    const metadataString = Object.keys(voiceChoices).length ? `[Voices: ${JSON.stringify(voiceChoices)}]\n\n` : "";
    const finalConversation = metadataString + tts.conversation;

    onGenerateAudio({
      ...tts,
      conversation: finalConversation,
    });
    // Assuming success, the parent will reload the module and the effect above will set isEditingTts to false.
  };

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
        <div className="audio-method-tabbed-container">
          <div className="vh-method-tabs">
            <button
              type="button"
              className={`vh-method-tab ${activeMethod === "upload" ? "is-active" : ""}`}
              onClick={() => setActiveMethod("upload")}
            >
              Upload MP3 File
            </button>
            <button
              type="button"
              className={`vh-method-tab ${activeMethod === "tts" ? "is-active" : ""}`}
              onClick={() => setActiveMethod("tts")}
            >
              Browser-Narrated Transcript
            </button>
          </div>

          <div className="audio-method-single-form">
            {activeMethod === "upload" ? (
              <form onSubmit={onUploadAudio} className="vh-tabbed-method-form">
                <h3>{t.uploadHeading}</h3>
                <label htmlFor="audio-title">{t.audioTitleLabel}<RequiredMark /></label>
                <input id="audio-title" value={audioTitle} onChange={(event) => onAudioTitleChange(event.target.value)} required />
                <label htmlFor="audio-file">{t.fileLabel}<RequiredMark /></label>
                <input id="audio-file" type="file" accept=".mp3,audio/mpeg" onChange={(event) => onAudioFileChange(event.target.files?.[0] ?? null)} required />
                
                {audioFile && (
                  <div className="audio-preview-container" style={{ margin: "16px 0" }}>
                    <p className="hint" style={{ marginBottom: "8px" }}>Preview selected audio:</p>
                    <audio controls src={URL.createObjectURL(audioFile)} style={{ width: "100%", height: "40px" }} />
                  </div>
                )}

                <button type="submit" disabled={busy || !audioFile}>
                  {busy ? t.working : t.attach}
                </button>
              </form>
            ) : isEditingTts ? (
              <form onSubmit={handleGenerateSubmit} className="vh-tabbed-method-form">
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
                  
                  {detectedTtsSpeakers.length > 0 && (
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {detectedTtsSpeakers.map((speaker) => (
                        <div key={speaker} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px", background: "var(--surface-color-variant)", borderRadius: "6px" }}>
                          <span style={{ fontWeight: 500 }}>{speaker}</span>
                          <div style={{ width: "200px" }}>
                            <SearchableSelect
                              id={`voice-select-${speaker}`}
                              options={[
                                { value: "auto", label: "Auto-assign" },
                                { value: "male", label: "Male voice" },
                                { value: "female", label: "Female voice" }
                              ]}
                              value={voiceChoices[speaker] || "auto"}
                              onChange={(val) => setVoiceChoices(prev => ({ ...prev, [speaker]: val as any }))}
                              searchable={false}
                              className="form-dropdown-select"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  <button type="submit" disabled={busy || !tts.conversation.trim() || detectedTtsSpeakers.length > 6}>
                    {busy ? t.working : (existingTtsAsset ? "Update browser narration" : t.saveNarration)}
                  </button>
                  {existingTtsAsset && (
                    <Button variant="secondary" onClick={() => setIsEditingTts(false)} disabled={busy}>Cancel</Button>
                  )}
                </div>
              </form>
            ) : (
              <div className="vh-tabbed-method-form">
                <h3>{t.generateHeading}</h3>
                <p className="hint">{t.generatedOnStudentDevice}</p>
                {existingTtsAsset && <BrowserNarrationPreview asset={existingTtsAsset} />}
                
                {existingTtsAsset?.transcript && (
                  <details style={{ marginTop: "16px", marginBottom: "16px" }}>
                    <summary>{t.transcript}</summary>
                    <p style={{ whiteSpace: "pre-wrap" }}>{stripVoiceMetadata(existingTtsAsset.transcript)}</p>
                  </details>
                )}

                <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                  <Button variant="secondary" onClick={() => setIsEditingTts(true)}>
                    Edit Transcript
                  </Button>
                  <button type="button" className="danger-text" onClick={() => onDeleteAudio(existingTtsAsset!.id)}>
                    {t.delete}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="part-audio-list">
        {!part.assets.length ? (
          <p className="empty-message">{t.noAudio}</p>
        ) : (
          part.assets
            .filter((asset: ExamModuleAsset) => asset.asset_type !== "tts_text")
            .map((asset: ExamModuleAsset) => (
              <article key={asset.id}>
                <div>
                  <strong>{asset.title}</strong>
                  <small>
                    {asset.asset_type === "tts_mp3"
                      ? t.legacyGeneratedVoice(asset.tts_voice ?? "")
                      : asset.original_filename}
                  </small>
                </div>
                {asset.url ? (
                  <audio controls preload="metadata" src={`${API_BASE_URL}${asset.url}`}>
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
