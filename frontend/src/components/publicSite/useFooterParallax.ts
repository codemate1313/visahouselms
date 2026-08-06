import { useEffect } from "react";

/**
 * Drifts the footer's world-map background (`--vh-map-shift`, consumed by
 * `.vh-footer::before` in chrome.css) as it scrolls through the viewport.
 * Ported from the DC pages' `footer-parallax.js`, minus the retry-polling for
 * `.vh-footer` to exist — that raced the iframe's own load, which doesn't
 * apply once this runs as a normal React effect against a ref.
 */
export function useFooterParallax(footerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const node = footerRef.current;
    if (!node) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    let frame: number | null = null;
    const update = () => {
      frame = null;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      const progress = Math.min(Math.max(1 - rect.top / viewport, 0), 1);
      const shift = ((0.5 - progress) * 90).toFixed(1);
      node.style.setProperty("--vh-map-shift", `${shift}px`);
    };
    const onScrollOrResize = () => {
      if (frame != null) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [footerRef]);
}
