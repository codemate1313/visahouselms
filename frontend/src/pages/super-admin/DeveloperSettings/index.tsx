import { useState } from "react";
import { SegmentedControl } from "@/components/ui";
import { tabLabels, tabOrder } from "./DeveloperSettings.strings";
import type { Tab } from "./types";
import { TypographyTab } from "./components/TypographyTab";
import { LoginSliderTab } from "./components/LoginSliderTab";
import { SmtpTab } from "./components/SmtpTab";
import { FcmTab } from "./components/FcmTab";
import { AvatarTab } from "./components/AvatarTab";
import { AiEvaluationTab } from "./components/AiEvaluationTab";
import { MaintenanceTab } from "./components/MaintenanceTab";
import { BackupsTab } from "./components/BackupsTab";
import { SeedTab } from "./components/SeedTab";

export function DeveloperSettings() {
  const [tab, setTab] = useState<Tab>("typography");

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
      {tab === "smtp" && <SmtpTab />}
      {tab === "fcm" && <FcmTab />}
      {tab === "avatar" && <AvatarTab />}
      {tab === "ai" && <AiEvaluationTab />}
      {tab === "maintenance" && <MaintenanceTab />}
      {tab === "backups" && <BackupsTab />}
      {tab === "seed" && <SeedTab />}
    </div>
  );
}
