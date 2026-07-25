import { API_BASE_URL } from "@/api/client";
import type { ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface SpeakingAvatarPanelProps {
  part: ExamModulePart;
  isEditable: boolean;
  avatarGenerating: boolean;
  onGenerateAvatar: () => void;
  onDeleteAudio: (assetId: number) => void;
}

export function SpeakingAvatarPanel({ part, isEditable, avatarGenerating, onGenerateAvatar, onDeleteAudio }: SpeakingAvatarPanelProps) {
  const t = strings.speakingAvatar;
  const avatarAssets = part.assets.filter((asset) => asset.asset_type === "avatar_mp4");
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
        <div className="form-actions">
          <button type="button" onClick={onGenerateAvatar} disabled={avatarGenerating || !part.questions.length}>
            {avatarGenerating ? t.generating : t.generate}
          </button>
        </div>
      )}
      <div className="part-audio-list">
        {!avatarAssets.length ? (
          <p className="empty-message">{t.noVideo}</p>
        ) : (
          avatarAssets.map((asset) => (
            <article key={asset.id}>
              <div>
                <strong>{asset.title}</strong>
              </div>
              <video controls preload="metadata" src={`${API_BASE_URL}${asset.url}`} style={{ maxWidth: 320 }}>
                Your browser does not support video.
              </video>
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
