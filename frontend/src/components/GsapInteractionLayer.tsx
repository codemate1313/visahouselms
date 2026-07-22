import { useEffect } from "react";
import gsap from "gsap";

const INTERACTIVE_SELECTOR = [
  "button:not(:disabled)",
  "a",
  ".tab",
  ".sidebar-item",
  ".stat-tile",
  ".feature-card",
  ".pricing-card",
  ".typography-slider-row",
].join(",");

export function GsapInteractionLayer() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return undefined;

    const activeTweens = new WeakMap<Element, gsap.core.Tween>();

    const animate = (element: Element, vars: gsap.TweenVars) => {
      activeTweens.get(element)?.kill();
      activeTweens.set(element, gsap.to(element, vars));
    };

    const findTarget = (event: Event) => {
      const target = event.target instanceof Element ? event.target.closest(INTERACTIVE_SELECTOR) : null;
      if (!target || target.closest(".test-runner, .terminal-shell")) return null;
      return target;
    };

    const handlePointerEnter = (event: Event) => {
      const target = findTarget(event);
      if (!target) return;
      animate(target, { y: -2, scale: 1.01, duration: 0.18, ease: "power2.out" });
    };

    const handlePointerLeave = (event: Event) => {
      const target = findTarget(event);
      if (!target) return;
      animate(target, { y: 0, scale: 1, duration: 0.22, ease: "power2.out" });
    };

    const handlePointerDown = (event: Event) => {
      const target = findTarget(event);
      if (!target) return;
      animate(target, { y: 0, scale: 0.985, duration: 0.08, ease: "power2.out" });
    };

    const handlePointerUp = (event: Event) => {
      const target = findTarget(event);
      if (!target) return;
      animate(target, { y: -2, scale: 1.01, duration: 0.14, ease: "power2.out" });
    };

    document.addEventListener("pointerenter", handlePointerEnter, true);
    document.addEventListener("pointerleave", handlePointerLeave, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointerup", handlePointerUp, true);

    return () => {
      document.removeEventListener("pointerenter", handlePointerEnter, true);
      document.removeEventListener("pointerleave", handlePointerLeave, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
    };
  }, []);

  return null;
}
