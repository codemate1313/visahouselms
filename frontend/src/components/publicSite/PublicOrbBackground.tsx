import { useEffect, useRef } from "react";

const DEPTHS: Record<"a" | "b" | "c", number> = { a: 0.16, b: -0.1, c: 0.06 };

/**
 * The three blurred, drifting brand-color orbs behind every public page's
 * hero. Purely decorative (`aria-hidden`), with the same scroll parallax the
 * DC pages applied via `.vh-parallax[data-depth]` + `bindParallax`.
 */
export function PublicOrbBackground() {
  const fieldRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    let frame: number | null = null;
    const onScroll = () => {
      if (frame != null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const y = window.scrollY || 0;
        field.querySelectorAll<HTMLElement>("[data-orb]").forEach((node) => {
          const depth = DEPTHS[node.dataset.orb as "a" | "b" | "c"] ?? 0;
          node.style.transform = `translate3d(0, ${Math.round(y * depth)}px, 0)`;
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <>
      <div ref={fieldRef} className="vh-orb-field" aria-hidden="true">
        <div className="vh-orb vh-orb-a" data-orb="a" />
        <div className="vh-orb vh-orb-b" data-orb="b" />
        <div className="vh-orb vh-orb-c" data-orb="c" />
      </div>
      <div className="vh-orb-vignette" aria-hidden="true" />
    </>
  );
}
