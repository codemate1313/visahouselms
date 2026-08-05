import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SegmentedControl } from "@/components/ui";
import { tabLabels, tabOrder } from "./DeveloperSettings.strings";
import type { Tab } from "./types";
import { TypographyTab } from "./components/TypographyTab";
import { LoginSliderTab } from "./components/LoginSliderTab";
import { ContactSocialTab } from "./components/ContactSocialTab";
import { SmtpTab } from "./components/SmtpTab";
import { FcmTab } from "./components/FcmTab";
import { AvatarTab } from "./components/AvatarTab";
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
        options={tabOrder.map((value) => ({ label: tabLabels[value], value }))}
        value={tab}
      />
      {tab === "typography" && <TypographyTab />}
      {tab === "slider" && <LoginSliderTab />}
      {tab === "contact" && <ContactSocialTab />}
      {tab === "smtp" && <SmtpTab />}
      {tab === "fcm" && <FcmTab />}
      {tab === "avatar" && <AvatarTab />}
      {tab === "ai" && <AiEvaluationTab />}
      {tab === "payment-gateways" && <PaymentGatewaysTab />}
      {tab === "maintenance" && <MaintenanceTab />}
      {tab === "backups" && <BackupsTab />}
      {tab === "seed" && <SeedTab />}
    </div>
  );
}
