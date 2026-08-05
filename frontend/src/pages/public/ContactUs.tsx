import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiClient } from "@/api/client";
import { StaticDcPage } from "./StaticDcPage";
import { contactUsStrings as strings } from "./ContactUs.strings";
import type { LandingPlan, LandingPlansPayload } from "./Plans.types";
import { useContactSettings } from "./useContactSettings";

export function ContactUs() {
  const location = useLocation();
  // The apply form names the tier the visitor arrived from, and plan ids are
  // whatever the database assigned - so the catalogue is handed over rather
  // than guessed at inside the framed page.
  const [institutePlans, setInstitutePlans] = useState<LandingPlan[]>([]);
  const contactSettings = useContactSettings();

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<LandingPlansPayload>("/plans", { headers: { "X-Skip-Loader": "true" } })
      .then(({ data }) => {
        if (!cancelled) setInstitutePlans(data.institutes ?? []);
      })
      // Only used to name a tier back to the visitor, so a failed load leaves
      // that line off rather than blocking the form.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const bootstrap = useMemo(
    () => ({ search: location.search, institutePlans, contactSettings }),
    [location.search, institutePlans, contactSettings],
  );

  return <StaticDcPage fileName={strings.fileName} title={strings.title} bootstrap={bootstrap} />;
}
