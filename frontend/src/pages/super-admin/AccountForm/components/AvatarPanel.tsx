import type { ChangeEvent } from "react";
import { accountFormStrings as strings } from "../AccountForm.strings";

interface AvatarPanelProps {
  isNew: boolean;
  avatarPreview: string;
  fullName: string;
  email: string;
  initials: string;
  avatarFileName: string;
  uploadingAvatar: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function AvatarPanel({ isNew, avatarPreview, fullName, email, initials, avatarFileName, uploadingAvatar, onFileChange }: AvatarPanelProps) {
  const t = strings.avatar;
  return (
    <aside className="account-profile-panel">
      <div className="account-avatar-preview">
        {avatarPreview ? <img src={avatarPreview} alt="Avatar preview" /> : <span>{initials}</span>}
      </div>
      <div className="account-profile-copy">
        <span className="phase-chip">{isNew ? t.newProfile : t.profileImage}</span>
        <h2>{fullName || strings.avatar.defaultName}</h2>
        <p>{email || t.defaultEmailHint}</p>
      </div>
      <div className="account-upload-box">
        <strong>{t.label}</strong>
        <input id="avatar-file-upload" type="file" accept="image/*" onChange={onFileChange} disabled={uploadingAvatar} hidden />
        <label className="avatar-upload-cta" htmlFor="avatar-file-upload">
          {uploadingAvatar ? t.uploading : t.chooseImage}
        </label>
        <span>{avatarFileName || t.fileHint}</span>
      </div>
    </aside>
  );
}
