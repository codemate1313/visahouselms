import { useState, useEffect, type ChangeEvent, type ReactNode } from "react";
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
  const [imgError, setImgError] = useState(false);
  const displayName = `${firstName} ${lastName}`.trim() || roleLabel;

  useEffect(() => {
    setImgError(false);
  }, [avatarSrc]);

  return (
    <div className="role-profile-page" data-profile-tone={tone}>
      <div className="page-header role-profile-page-header">
        <div>
          <span className="page-eyebrow">{roleLabel} Account</span>
          <h1>My Profile</h1>
          <p className="page-subtitle">Manage your profile avatar and personal account credentials.</p>
        </div>
      </div>

      <div className="role-profile-layout">
        {/* Left Side: Modern Identity & Avatar Card */}
        <aside className="role-profile-identity" aria-label={`${roleLabel} profile image`}>
          <div className="role-profile-cover-banner">
            <span className="role-profile-badge-pill">{roleLabel}</span>
          </div>

          <div className="role-profile-avatar-container">
            <div className="role-profile-avatar-frame">
              {avatarSrc && !imgError ? (
                <img
                  src={avatarSrc}
                  alt={`${displayName} profile`}
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="role-profile-initials-badge">{initials || "?"}</span>
              )}
              <label
                htmlFor={avatarInputId}
                className={`role-profile-avatar-overlay${uploading ? " is-disabled" : ""}`}
                title="Click to change photo"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </label>
            </div>
          </div>

          <div className="role-profile-summary">
            <h2>{displayName}</h2>
            <p className="role-profile-email">{email}</p>
          </div>

          <div className="role-profile-upload-zone">
            <div className="role-profile-photo-info">
              <strong>Profile Photo</strong>
              <span>PNG, JPEG, or WebP up to 5MB</span>
            </div>
            <label htmlFor={avatarInputId} className={`role-profile-upload-button${uploading ? " is-disabled" : ""}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>{uploading ? "Uploading..." : "Upload New Photo"}</span>
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

        {/* Right Side: Account Personal Details Form */}
        <CollapsiblePanel
          className="role-profile-form-panel"
          eyebrow="Account Details"
          title="Personal Information"
          description="Keep your contact and identity details accurate and up-to-date."
        >
          {children}
        </CollapsiblePanel>
      </div>
    </div>
  );
}
