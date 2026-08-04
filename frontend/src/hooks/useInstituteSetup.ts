import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";

interface SubscriptionProbe {
  subscription: { plan_name: string; expires_at: string } | null;
}

/**
 * Whether this institute still has to buy its first term.
 *
 * An institute approved from a public application exists and its admin can sign
 * in, but nothing behind it is provisioned until a plan is paid for - seat
 * limits resolve to nothing, so every "add someone" call 402s. Rather than let
 * an admin walk into those errors one at a time, the portal holds them in the
 * setup wizard until this returns false.
 *
 * A failed probe is treated as "set up". A network blip should not lock an
 * established institute out of its own portal; the API enforces entitlement
 * independently either way.
 */
export function useInstituteSetup(): { loading: boolean; needsSetup: boolean } {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<SubscriptionProbe>("/institute/subscription", { headers: { "X-Skip-Loader": "true" } })
      .then(({ data }) => {
        if (!cancelled) setNeedsSetup(data.subscription === null);
      })
      .catch(() => {
        if (!cancelled) setNeedsSetup(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, needsSetup };
}
