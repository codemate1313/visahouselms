import { useEffect, useState } from "react";
import { instituteDashboardStrings as strings } from "../InstituteDashboard.strings";
import type { AccessWindow } from "../types";
import { LinkButton } from "@/components/ui";

interface AccessCountdownCardProps {
  access: AccessWindow;
  canSeeBilling: boolean;
}

const URGENT_SECONDS = 7 * 24 * 60 * 60;

/** Counts down to the moment the institute loses access (plan expiry plus its
 *  grace days) and spells out that every downline account goes with it. The
 *  countdown starts from the server's seconds_remaining rather than the local
 *  clock, so a skewed device cannot show a deadline that has not arrived. */
export function AccessCountdownCard({ access, canSeeBilling }: AccessCountdownCardProps) {
  const t = strings.accessCountdown;
  const [secondsLeft, setSecondsLeft] = useState(access.seconds_remaining ?? 0);

  useEffect(() => {
    setSecondsLeft(access.seconds_remaining ?? 0);
  }, [access.seconds_remaining]);

  useEffect(() => {
    if (access.seconds_remaining === null) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => Math.max(0, previous - 60));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [access.seconds_remaining]);

  if (access.access_ends_at === null) return null;

  const ended = secondsLeft <= 0 || access.state === "expired" || access.institute_suspended;
  const tone = ended ? "danger" : secondsLeft <= URGENT_SECONDS || access.state === "grace" ? "warning" : "calm";

  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const deadline = new Date(access.access_ends_at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className={`access-countdown-card is-${tone}`} role="alert">
      <div className="access-countdown-meter">
        <span className="access-countdown-label">
          {ended ? t.endedLabel : access.state === "grace" ? t.graceLabel : t.activeLabel}
        </span>
        <strong className="access-countdown-value">
          {ended ? t.endedValue : t.timeLeft(days, hours, minutes)}
        </strong>
        <span className="access-countdown-deadline">{ended ? t.endedOn(deadline) : t.endsOn(deadline)}</span>
      </div>

      <div className="access-countdown-body">
        <span className="access-countdown-plan">{t.plan(access.plan_name)}</span>
        <p className="access-countdown-warning">{ended ? t.endedWarning : t.warning}</p>
        {!ended && access.grace_days > 0 && <p className="access-countdown-note">{t.graceNote(access.grace_days)}</p>}
        {canSeeBilling && (
          <LinkButton to="/institute-portal/billing">
            {t.renew}
          </LinkButton>
        )}
      </div>
    </div>
  );
}
