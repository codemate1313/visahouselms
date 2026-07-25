import { useState } from "react";
import { developerSettingsStrings as strings, tabLabels, tabOrder } from "./DeveloperSettings.strings";
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
      <h1>{strings.pageTitle}</h1>
      <div className="tab-bar">
        {tabOrder.map((t) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {tabLabels[t]}
          </button>
        ))}
      </div>
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
