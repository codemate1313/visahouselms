import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
import { dangerousTabs, tabLabels, tabOrder } from "./DeveloperSettings.strings";
import type { Tab } from "./types";
import { StaticOtpTab } from "./components/StaticOtpTab";
import { HeroSliderTab } from "./components/HeroSliderTab";
import { ContactSocialTab } from "./components/ContactSocialTab";
import { SmtpTab } from "./components/SmtpTab";
import { AiEvaluationTab } from "./components/AiEvaluationTab";
import { GoogleOAuthTab } from "./components/GoogleOAuthTab";
import { PaymentGatewaysTab } from "./components/PaymentGatewaysTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { BackupsTab } from "./components/BackupsTab";

function parseTab(value: string | null): Tab {
  return tabOrder.includes(value as Tab) ? (value as Tab) : "slider";
}

export function DeveloperSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTabState] = useState<Tab>(() => parseTab(searchParams.get("tab")));

  function setTab(next: Tab) {
    setTabState(next);
    setSearchParams(next === "slider" ? {} : { tab: next });
  }

  return (
    <div>
      <SegmentedControl
        ariaLabel="Developer settings section"
        className="developer-settings-tabs"
        onChange={setTab}
        options={tabOrder.map((value) => ({
          label: tabLabels[value],
          value,
          icon: dangerousTabs.includes(value) ? <Icon name="warning" className="developer-settings-tab-warning-icon" /> : undefined,
          title: dangerousTabs.includes(value) ? "Higher-risk setting - use with care" : undefined,
        }))}
        value={tab}
      />
      {tab === "slider" && <HeroSliderTab />}
      {tab === "contact" && <ContactSocialTab />}
      {tab === "smtp" && <SmtpTab />}
      {tab === "ai" && <AiEvaluationTab />}
      {tab === "google-oauth" && <GoogleOAuthTab />}
      {tab === "payment-gateways" && <PaymentGatewaysTab />}
      {tab === "backups" && <BackupsTab />}
      {tab === "otp" && <StaticOtpTab />}
      {tab === "maintenance" && <MaintenanceTab />}
    </div>
  );
}
