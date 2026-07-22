import { useEffect, useRef, useLayoutEffect } from "react";
import gsap from "gsap";
import { Login } from "../../pages/Login";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  useLayoutEffect(() => {
    if (!isOpen || !overlayRef.current || !wrapperRef.current) return;
    
    const ctx = gsap.context(() => {
      // Fade in the dark overlay backdrop (very fast)
      gsap.fromTo(
        overlayRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.15, ease: "power2.out" }
      );
      
      // Extremely snappy and bouncy popup for the modal wrapper
      gsap.fromTo(
        wrapperRef.current,
        { autoAlpha: 0, scale: 0.5, y: 40 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(2.5)" }
      );
      
      // Staggered fade-in for background orbs
      gsap.fromTo(
        ".glowing-orb",
        { autoAlpha: 0, scale: 0.8 },
        { autoAlpha: 0.6, scale: 1, duration: 0.6, ease: "power2.out", stagger: 0.1 }
      );
    }, overlayRef);
    
    return () => ctx.revert();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="login-modal-overlay" ref={overlayRef} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="login-modal-wrapper"
        ref={wrapperRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          className="login-modal-close-btn"
          onClick={onClose}
          aria-label="Close dialog"
          title="Close (Esc)"
        >
          ✕
        </button>

        {/* Login Component inside Modal */}
        <Login disableAnimation={true} />
      </div>
    </div>
  );
}
