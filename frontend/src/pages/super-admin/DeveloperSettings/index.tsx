import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
import { dangerousTabs, tabLabels, tabOrder } from "./DeveloperSettings.strings";
import type { Tab } from "./types";
import { TypographyTab } from "./components/TypographyTab";
import { StaticOtpTab } from "./components/StaticOtpTab";
import { HeroSliderTab } from "./components/HeroSliderTab";
import { ContactSocialTab } from "./components/ContactSocialTab";
import { SmtpTab } from "./components/SmtpTab";
import { FcmTab } from "./components/FcmTab";
import { AiEvaluationTab } from "./components/AiEvaluationTab";
import { PaymentGatewaysTab } from "./components/PaymentGatewaysTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { BackupsTab } from "./components/BackupsTab";
import { SeedTab } from "./components/SeedTab";

function parseTab(value: string | null): Tab {
  return tabOrder.includes(value as Tab) ? (value as Tab) : "typography";
}

export function DeveloperSettings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTabState] = useState<Tab>(() => parseTab(searchParams.get("tab")));

  function setTab(next: Tab) {
    setTabState(next);
    setSearchParams(next === "typography" ? {} : { tab: next });
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
      {tab === "typography" && <TypographyTab />}
      {tab === "otp" && <StaticOtpTab />}
      {tab === "slider" && <HeroSliderTab />}
      {tab === "contact" && <ContactSocialTab />}
      {tab === "smtp" && <SmtpTab />}
      {tab === "fcm" && <FcmTab />}
      {tab === "ai" && <AiEvaluationTab />}
      {tab === "payment-gateways" && <PaymentGatewaysTab />}
      {tab === "maintenance" && <MaintenanceTab />}
      {tab === "backups" && <BackupsTab />}
      {tab === "seed" && <SeedTab />}
    </div>
  );
}
