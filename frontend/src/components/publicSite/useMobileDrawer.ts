import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { lockBodyScroll } from "@/utils/scrollLock";

/**
 * Drives the header's hamburger-to-X morph, scrim fade and drawer
 * height/opacity reveal. Ported from the DC pages' `setMobileMenu`, which was
 * copy-pasted verbatim across all 5 marketing pages.
 */
export function useMobileDrawer() {
  const [open, setOpenState] = useState(false);
  const openRef = useRef(false);
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const line1Ref = useRef<SVGLineElement | null>(null);
  const line2Ref = useRef<SVGLineElement | null>(null);
  const line3Ref = useRef<SVGLineElement | null>(null);
  const releaseScrollRef = useRef<(() => void) | null>(null);

  const setMenu = useCallback((next: boolean) => {
    if (openRef.current === next) return;
    openRef.current = next;
    setOpenState(next);

    const drawer = drawerRef.current;
    const scrim = scrimRef.current;
    if (next) {
      releaseScrollRef.current = lockBodyScroll();
    } else {
      releaseScrollRef.current?.();
      releaseScrollRef.current = null;
    }
    if (!drawer) return;
    const items = drawer.querySelectorAll<HTMLElement>(".vh-drawer-item");

    if (line1Ref.current && line2Ref.current && line3Ref.current) {
      gsap.to(line1Ref.current, { y: next ? 6 : 0, rotation: next ? 45 : 0, transformOrigin: "center", duration: 0.34, ease: "power3.out" });
      gsap.to(line2Ref.current, { opacity: next ? 0 : 1, scaleX: next ? 0.4 : 1, transformOrigin: "center", duration: 0.24, ease: "power2.out" });
      gsap.to(line3Ref.current, { y: next ? -6 : 0, rotation: next ? -45 : 0, transformOrigin: "center", duration: 0.34, ease: "power3.out" });
    }

    if (scrim) {
      gsap.killTweensOf(scrim);
      if (next) {
        gsap.set(scrim, { display: "block" });
        gsap.to(scrim, { opacity: 1, duration: 0.35, ease: "power2.out" });
      } else {
        gsap.to(scrim, {
          opacity: 0,
          duration: 0.26,
          ease: "power2.in",
          onComplete: () => {
            if (!openRef.current) gsap.set(scrim, { display: "none" });
          },
        });
      }
    }

    gsap.killTweensOf(drawer);
    if (items.length) gsap.killTweensOf(items);

    if (next) {
      gsap.set(drawer, { display: "flex" });
      gsap.fromTo(drawer, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.46, ease: "power3.out" });
      if (items.length) {
        gsap.fromTo(items, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.045, delay: 0.06, ease: "power3.out" });
      }
    } else {
      if (items.length) gsap.to(items, { y: 8, opacity: 0, duration: 0.18, ease: "power2.in" });
      gsap.to(drawer, {
        height: 0,
        opacity: 0,
        duration: 0.32,
        delay: 0.05,
        ease: "power3.in",
        onComplete: () => {
          if (!openRef.current) gsap.set(drawer, { display: "none" });
        },
      });
    }
  }, []);

  const toggle = useCallback(() => setMenu(!openRef.current), [setMenu]);
  const close = useCallback(() => setMenu(false), [setMenu]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Esc") close();
    }
    function onResize() {
      if (window.innerWidth > 1024) close();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  // Unmounting mid-open must not leave the scroll lock held forever.
  useEffect(() => () => releaseScrollRef.current?.(), []);

  return { open, toggle, close, drawerRef, scrimRef, line1Ref, line2Ref, line3Ref };
}
