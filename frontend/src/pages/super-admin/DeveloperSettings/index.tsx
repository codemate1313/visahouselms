import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
import { dangerousTabs, tabLabels, tabOrder } from "./DeveloperSettings.strings";
import type { Tab } from "./types";
import { StaticOtpTab } from "./components/StaticOtpTab";
import { HeroAndSocialsTab } from "./components/HeroAndSocialsTab";
import { SmtpTab } from "./components/SmtpTab";
import { AiEvaluationTab } from "./components/AiEvaluationTab";
import { GoogleOAuthTab } from "./components/GoogleOAuthTab";
import { PaymentGatewaysTab } from "./components/PaymentGatewaysTab";
import { MaintenanceTab } from "./components/MaintenanceTab";

function parseTab(value: string | null, allowedTabs: Tab[]): Tab {
  if (value === "slider" || value === "contact") return "hero-socials";
  if (value === "backups") return "maintenance";
  if (value && allowedTabs.includes(value as Tab)) return value as Tab;
  return "hero-socials";
}

export function DeveloperSettings() {
  const user = useAuthStore((s) => s.user);
  const isDeveloper = user?.role === "DEVELOPER";
  const [searchParams, setSearchParams] = useSearchParams();

  const availableTabs = useMemo(() => {
    // Only developers see the Static OTP testing tab; Super Admin does not.
    return isDeveloper ? tabOrder : tabOrder.filter((t) => t !== "otp");
  }, [isDeveloper]);

  const [tab, setTabState] = useState<Tab>(() => parseTab(searchParams.get("tab"), availableTabs));

  function setTab(next: Tab) {
    setTabState(next);
    setSearchParams(next === "hero-socials" ? {} : { tab: next });
  }

  return (
    <div>
      <SegmentedControl
        ariaLabel="Developer settings section"
        className="developer-settings-tabs"
        onChange={setTab}
        options={availableTabs.map((value) => ({
          label: tabLabels[value],
          value,
          icon: dangerousTabs.includes(value) ? <Icon name="warning" className="developer-settings-tab-warning-icon" /> : undefined,
          title: dangerousTabs.includes(value) ? "Higher-risk setting - use with care" : undefined,
        }))}
        value={tab}
      />
      {tab === "hero-socials" && <HeroAndSocialsTab />}
      {tab === "smtp" && <SmtpTab />}
      {tab === "ai" && <AiEvaluationTab />}
      {tab === "google-oauth" && <GoogleOAuthTab />}
      {tab === "payment-gateways" && <PaymentGatewaysTab />}
      {tab === "otp" && isDeveloper && <StaticOtpTab />}
      {tab === "maintenance" && <MaintenanceTab />}
    </div>
  );
}
