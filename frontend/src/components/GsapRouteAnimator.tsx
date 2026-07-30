import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";

const ANIMATED_CHILDREN = [
  "h1",
  ".section-title",
  ".metric-card",
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
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.32,
          ease: "power2.out",
          // Drop the finished transform instead of leaving matrix(1,0,0,1,0,0)
          // behind. Any transform - identity included - makes this element the
          // containing block for its position:fixed descendants, which pinned
          // every modal backdrop to the content area rather than the viewport,
          // so the sidebar and header stayed unblurred behind an open dialog.
          clearProps: "transform",
        },
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
            clearProps: "transform",
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
