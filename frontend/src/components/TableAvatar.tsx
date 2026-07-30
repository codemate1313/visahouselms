import { type CSSProperties, useEffect, useState } from "react";

interface TableAvatarProps {
  /** Fully resolved image URL, or null/undefined when the record has no image. */
  src?: string | null;
  /** Name the initial is derived from when no image is shown. */
  name: string;
  alt?: string;
  /** Stable value used to derive the fallback avatar hue. Defaults to name. */
  seed?: string | number;
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
const AVATAR_HUES = [12, 45, 92, 160, 210, 260, 305];

function hashSeed(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function TableAvatar({ src, name, alt = "", seed }: TableAvatarProps) {
  const [failed, setFailed] = useState(false);

  // A row reused for a different record must retry the new image.
  useEffect(() => setFailed(false), [src]);

  const initial = getTwoLetterInitials(name);
  const hue = AVATAR_HUES[hashSeed(String(seed ?? name)) % AVATAR_HUES.length];
  const style = {
    "--table-avatar-bg": `oklch(0.68 0.16 ${hue})`,
  } as CSSProperties;

  return (
    <div className="table-avatar-tile" style={style}>
      {src && !failed ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </div>
  );
}
