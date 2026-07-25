import type { ChangeEvent } from "react";
import { instructorFormStrings as strings } from "../InstructorForm.strings";

interface AvatarUploadFieldProps {
  avatarPreview: string;
  uploadingAvatar: boolean;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function AvatarUploadField({ avatarPreview, uploadingAvatar, onFileChange }: AvatarUploadFieldProps) {
  const t = strings.avatar;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          backgroundColor: "var(--red-100)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          border: "2px solid var(--shade-fca5a5)",
          flexShrink: 0,
        }}
      >
        {avatarPreview ? (
          <img src={avatarPreview} alt="Avatar Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: "24px" }}>👨‍🏫</span>
        )}
      </div>
      <div>
        <label htmlFor="instructor-avatar-upload" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
          {t.label}
        </label>
        <input id="instructor-avatar-upload" type="file" accept="image/*" onChange={onFileChange} disabled={uploadingAvatar} />
        {uploadingAvatar && (
          <span className="hint" style={{ color: "var(--danger)", marginLeft: "8px" }}>
            {t.uploading}
          </span>
        )}
      </div>
    </div>
  );
}
