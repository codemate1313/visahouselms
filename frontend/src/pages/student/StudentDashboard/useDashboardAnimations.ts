import { useLayoutEffect, type RefObject } from "react";
import gsap from "gsap";

/** Entrance/count-up/progress-bar animations for the dashboard, gated on data being ready. */
export function useDashboardAnimations(containerRef: RefObject<HTMLDivElement | null>, ready: boolean) {
  useLayoutEffect(() => {
    if (!ready || !containerRef.current) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const ctx = gsap.context(() => {
      // 1. Entrance Animations
      const tl = gsap.timeline();

      tl.fromTo(".metric-card",
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          stagger: 0.08,
          ease: "power4.out",
          clearProps: "transform,opacity"
        },
        0.15
      );

      tl.fromTo(".workspace-panel",
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1.2,
          stagger: 0.2,
          ease: "expo.out",
          clearProps: "transform,opacity"
        },
        0.35
      );

      tl.fromTo(".sd-test-card",
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity"
        },
        0.6
      );

      tl.fromTo(".activity-item",
        { x: -30, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.06,
          ease: "power3.out",
          clearProps: "transform,opacity"
        },
        0.7
      );

      // 2. Progress Bars Fill
      gsap.utils.toArray<HTMLElement>(".sd-progress-fill", containerRef.current).forEach((el, index) => {
        const target = Number(el.dataset.progress ?? 0);
        gsap.fromTo(
          el,
          { width: "0%" },
          { width: `${target}%`, duration: 1, delay: 0.8 + index * 0.05, ease: "power3.out" },
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, [ready, containerRef]);
}
