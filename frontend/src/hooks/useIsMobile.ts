import { useEffect, useState } from "react";

/** The project-wide mobile cutover, matching the stylesheets. */
export const MOBILE_QUERY = "(max-width: 768px)";

/**
 * Whether the viewport is in the mobile range.
 *
 * Read synchronously on first render rather than in an effect, so a phone never
 * paints the desktop branch for a frame before swapping.
 */
export function useIsMobile(query: string = MOBILE_QUERY) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setIsMobile(list.matches);
    list.addEventListener("change", onChange);
    onChange();
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return isMobile;
}
