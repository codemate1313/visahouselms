import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";

const ANIMATED_CHILDREN = [
  "h1",
  ".section-title",
  ".stat-tile",
  ".form-card",
  ".table-card",
  ".data-table",
  ".filter-bar",
  ".tab-bar",
  ".card",
  ".panel",
  ".dashboard-card",
  ".typography-slider-row",
  ".typography-preview",
  ".form-actions",
].join(",");

interface GsapRouteAnimatorProps {
  children: ReactNode;
  className?: string;
}

export function GsapRouteAnimator({ children, className }: GsapRouteAnimatorProps) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  useLayoutEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return undefined;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return undefined;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        scope,
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out" },
      );

      const childrenToAnimate = gsap.utils.toArray<HTMLElement>(ANIMATED_CHILDREN, scope).slice(0, 24);
      if (childrenToAnimate.length) {
        gsap.fromTo(
          childrenToAnimate,
          { autoAlpha: 0, y: 18, scale: 0.985 },
          {
            autoAlpha: 1,
            y: 0,
            scale: 1,
            duration: 0.42,
            ease: "power3.out",
            stagger: 0.035,
            delay: 0.04,
          },
        );
      }
    }, scope);

    return () => ctx.revert();
  }, [location.pathname]);

  return (
    <div ref={scopeRef} className={className ?? "gsap-route-scope"}>
      {children}
    </div>
  );
}
