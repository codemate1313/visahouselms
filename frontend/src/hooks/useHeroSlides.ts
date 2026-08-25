import { useEffect, useState } from "react";
import { fetchPublicHeroSlides, type HeroLocation, type HeroSlideRecord } from "@/api/heroSlides";

/** Reads the Super-Admin-managed hero slides for one location.
 *
 * `fallback` is returned while the request is in flight and if it fails, so the
 * home and login heroes always render something even when the API is
 * unreachable. Slides arrive already filtered to the active ones and sorted by
 * display order. */
export function useHeroSlides(location: HeroLocation, fallback: HeroSlideRecord[]): HeroSlideRecord[] {
  const [slides, setSlides] = useState<HeroSlideRecord[]>(fallback);

  useEffect(() => {
    let cancelled = false;
    fetchPublicHeroSlides(location)
      .then((data) => {
        if (!cancelled && data.length > 0) setSlides(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [location]);

  return slides;
}
