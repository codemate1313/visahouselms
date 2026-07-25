import { instructorsStrings as strings } from "../Instructors.strings";
import type { PasswordNotice } from "../types";

interface PasswordNoticeBannerProps {
  notice: PasswordNotice;
  onCopy: () => void;
  onDismiss: () => void;
}

export function PasswordNoticeBanner({ notice, onCopy, onDismiss }: PasswordNoticeBannerProps) {
  const t = strings.passwordNotice;
  return (
    <div className="delivery-notice success" role="status" style={{ marginBottom: 20 }}>
      <span>
        {t.prefix} <strong>{notice.email}</strong>: <code>{notice.temporary_password}</code>
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="secondary-button" onClick={onCopy}>
          {t.copy}
        </button>
        <button className="secondary-button" onClick={onDismiss}>
          {t.dismiss}
        </button>
      </div>
    </div>
  );
}
