import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LandingHeader } from "./LandingHeader";
import { LandingFooter } from "./LandingFooter";
import { LoginModal } from "./LoginModal";

export function LandingLayout() {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const location = useLocation();
  const hasPlayedInitialReveal = useRef(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shouldAnimateReveal = !hasPlayedInitialReveal.current && !prefersReducedMotion;
    const revealTargets = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          ".landing-stats-section",
          ".stats-container",
          ".section-header",
          ".feature-card",
          ".landing-cta-banner",
          ".cta-banner-card",
          ".pricing-card",
          ".matrix-container",
          ".pillar-card",
          ".pedagogy-card",
          ".info-card",
          ".contact-form-card",
        ].join(",")
      )
    );

    revealTargets.forEach((target, index) => {
      target.classList.add("landing-scroll-pop");
      target.style.setProperty("--pop-delay", `${Math.min(index % 4, 3) * 90}ms`);

      if (shouldAnimateReveal) {
        target.classList.remove("is-visible");
      } else {
        target.classList.add("is-visible");
      }
    });

    if (!shouldAnimateReveal) return undefined;
    hasPlayedInitialReveal.current = true;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -10% 0px" }
    );

    revealTargets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [location.pathname]);

  return (
    <div className="landing-layout-root">
      <LandingHeader onOpenLogin={() => setLoginModalOpen(true)} />
      <main className="landing-main-content">
        <Outlet context={{ openLoginModal: () => setLoginModalOpen(true) }} />
      </main>
      <LandingFooter />
      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </div>
  );
}
