import { useEffect, useState } from "react";

interface TableAvatarProps {
  /** Fully resolved image URL, or null/undefined when the record has no image. */
  src?: string | null;
  /** Name the initial is derived from when no image is shown. */
  name: string;
  alt?: string;
}

export function getTwoLetterInitials(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts[0]?.[0]?.toUpperCase() || "?";
}

/**
 * Avatar tile that falls back to 2-letter initials derived from `name`. The fallback also
 * covers a src that fails to load (deleted file, blocked request, 404), rendering 2-letter
 * initials instead of a broken image icon.
 */
export function TableAvatar({ src, name, alt = "" }: TableAvatarProps) {
  const [failed, setFailed] = useState(false);

  // A row reused for a different record must retry the new image.
  useEffect(() => setFailed(false), [src]);

  const initial = getTwoLetterInitials(name);

  return (
    <div className="table-avatar-tile">
      {src && !failed ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </div>
  );
}
