import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import "@/styles/public/chrome.css";

export interface PublicCtaAction {
  label: ReactNode;
  href?: string;
  onClick?: () => void;
}

function CtaButton({ action, className }: { action: PublicCtaAction; className: string }) {
  if (action.href) {
    return (
      <Link to={action.href} className={className} onClick={action.onClick}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" className={className} onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export function PublicCtaBanner({
  heading,
  body,
  primary,
  secondary,
}: {
  heading: ReactNode;
  body: ReactNode;
  primary: PublicCtaAction;
  secondary?: PublicCtaAction;
}) {
  return (
    <section className="vh-cta-section vh-reveal">
      <div className="vh-cta-banner">
        <div className="vh-cta-bubbles" aria-hidden="true">
          <span className="vh-cta-bubble vh-cta-bubble-left" />
          <span className="vh-cta-bubble vh-cta-bubble-right" />
        </div>
        <div className="vh-cta-copy">
          <h2>{heading}</h2>
          <p>{body}</p>
        </div>
        <div className="vh-cta-actions">
          <CtaButton action={primary} className="vh-cta-btn-solid" />
          {secondary && <CtaButton action={secondary} className="vh-cta-btn-outline" />}
        </div>
      </div>
    </section>
  );
}
