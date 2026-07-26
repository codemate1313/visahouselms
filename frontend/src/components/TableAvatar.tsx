import { useEffect, useState } from "react";

interface TableAvatarProps {
  /** Fully resolved image URL, or null/undefined when the record has no image. */
  src?: string | null;
  /** Name the initial is derived from when no image is shown. */
  name: string;
  alt?: string;
}

/**
 * Avatar tile that falls back to the first letter of `name`. The fallback also
 * covers a src that fails to load (deleted file, blocked request, 404), which a
 * plain `src ? <img> : initial` check misses - that case renders a broken image
 * icon instead of the initial.
 */
export function TableAvatar({ src, name, alt = "" }: TableAvatarProps) {
  const [failed, setFailed] = useState(false);

  // A row reused for a different record must retry the new image.
  useEffect(() => setFailed(false), [src]);

  const initial = name.trim().charAt(0).toUpperCase() || "?";

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
