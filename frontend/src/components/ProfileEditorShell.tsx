import type { ChangeEvent, ReactNode } from "react";
import { CollapsiblePanel } from "./CollapsiblePanel";

type ProfileTone = "super-admin" | "instructor" | "institute" | "student";

interface ProfileEditorShellProps {
  roleLabel: string;
  tone: ProfileTone;
  firstName: string;
  lastName: string;
  email: string;
  avatarSrc: string | null;
  initials: string;
  uploading: boolean;
  avatarInputId: string;
  onAvatarChange: (event: ChangeEvent<HTMLInputElement>) => void;
  children: ReactNode;
}

export function ProfileEditorShell({
  roleLabel,
  tone,
  firstName,
  lastName,
  email,
  avatarSrc,
  initials,
  uploading,
  avatarInputId,
  onAvatarChange,
  children,
}: ProfileEditorShellProps) {
  const displayName = `${firstName} ${lastName}`.trim() || roleLabel;

  return (
    <div className="role-profile-page" data-profile-tone={tone}>
      <div className="page-header role-profile-page-header">
        <div>
          <span className="page-eyebrow">{roleLabel} account</span>
          <h1>My Profile</h1>
          <p className="page-subtitle">Manage your profile image and personal account details.</p>
        </div>
      </div>

      <div className="role-profile-layout">
        <aside className="role-profile-identity" aria-label={`${roleLabel} profile image`}>
          <div className="role-profile-cover" />
          <div className="role-profile-avatar-frame">
            {avatarSrc ? (
              <img src={avatarSrc} alt={`${displayName} profile`} />
            ) : (
              <span>{initials || "?"}</span>
            )}
          </div>

          <div className="role-profile-summary">
            <span className="role-profile-chip">Profile image</span>
            <h2>{displayName}</h2>
            <p>{email}</p>
          </div>

          <div className="role-profile-upload-zone">
            <div>
              <strong>Profile photo</strong>
              <span>PNG, JPEG, or WebP. Large images are compressed automatically.</span>
            </div>
            <label htmlFor={avatarInputId} className={`role-profile-upload-button${uploading ? " is-disabled" : ""}`}>
              {uploading ? "Uploading..." : "Choose image"}
            </label>
            <input
              id={avatarInputId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onAvatarChange}
              disabled={uploading}
              hidden
            />
          </div>
        </aside>

        <CollapsiblePanel
          className="role-profile-form-panel"
          eyebrow="Account details"
          title="Personal information"
          description="Keep your contact and identity details accurate."
        >
          {children}
        </CollapsiblePanel>
      </div>

    </div>
  );
}
