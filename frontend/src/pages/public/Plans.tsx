import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { StaticDcPage } from "./StaticDcPage";
import { plansStrings as strings } from "./Plans.strings";
import type { LandingPlansPayload } from "./Plans.types";
import { useContactSettings } from "./useContactSettings";

export function Plans() {
  const [payload, setPayload] = useState<LandingPlansPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const contactSettings = useContactSettings();

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<LandingPlansPayload>("/plans", { headers: { "X-Skip-Loader": "true" } })
      .then(({ data }) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) {
          // A failed load is not the same as "nothing is published": the page
          // says so, so both catalogues stay switched on with empty lists.
          setPayload({ show_direct: true, show_institutes: false, direct_students: [], institutes: [] });
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bootstrap = useMemo(
    () => ({
      studentPlans: payload?.direct_students ?? [],
      institutePlans: payload?.institutes ?? [],
      showStudentPlans: payload?.show_direct ?? false,
      showInstitutePlans: payload?.show_institutes ?? false,
      plansFailed: failed,
      contactSettings,
    }),
    [failed, payload, contactSettings]
  );

  return (
    <StaticDcPage
      fileName={strings.fileName}
      title={strings.title}
      bootstrap={bootstrap}
      bootstrapPending={payload === null}
    />
  );
}
