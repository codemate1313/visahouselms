import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { StaticDcPage } from "./StaticDcPage";
import { plansStrings as strings } from "./Plans.strings";
import type { LandingPlan } from "./Plans.types";

export function Plans() {
  const [plans, setPlans] = useState<LandingPlan[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<LandingPlan[]>("/plans", { headers: { "X-Skip-Loader": "true" } })
      .then(({ data }) => {
        if (!cancelled) setPlans(data);
      })
      .catch(() => {
        if (!cancelled) {
          setPlans([]);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bootstrap = useMemo(
    () => ({ plans: plans ?? [], plansFailed: failed }),
    [failed, plans]
  );

  return (
    <StaticDcPage
      fileName={strings.fileName}
      title={strings.title}
      bootstrap={bootstrap}
      bootstrapPending={plans === null}
    />
  );
}
