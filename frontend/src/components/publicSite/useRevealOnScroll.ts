import { useEffect } from "react";

/**
 * Adds `.vh-in` to every `.vh-reveal` descendant of `containerRef` as it
 * scrolls into view (once — then stops observing it). Mirrors the DC pages'
 * `observeReveal`.
 *
 * A `MutationObserver` (not just the initial scan) watches for `.vh-reveal`
 * nodes added later — cards that only exist once an async fetch resolves, or
 * that get swapped for new elements (new `key`) when a toggle changes what's
 * rendered, would otherwise never be observed and stay permanently invisible.
 */
export function useRevealOnScroll(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("vh-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "50px 0px 50px 0px" },
    );

    const observeNew = (scope: ParentNode) => {
      scope.querySelectorAll(".vh-reveal").forEach((node) => io.observe(node));
    };

    const frame = requestAnimationFrame(() => observeNew(root));

    const mo = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(".vh-reveal")) io.observe(node);
          observeNew(node);
        });
      }
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mo.disconnect();
      io.disconnect();
    };
  }, [containerRef]);
}
