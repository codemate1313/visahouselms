import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SegmentedControl } from "@/components/ui";
import { HeroSliderTab } from "./HeroSliderTab";
import { ContactSocialTab } from "./ContactSocialTab";

type SubTab = "sliders" | "socials";

const SUB_TAB_OPTIONS: { label: string; value: SubTab }[] = [
  { label: "Hero Sliders", value: "sliders" },
  { label: "Contact & Social", value: "socials" },
];

export function HeroAndSocialsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSubTab = searchParams.get("subtab") === "socials" ? "socials" : "sliders";
  const [subTab, setSubTabState] = useState<SubTab>(initialSubTab);

  function setSubTab(next: SubTab) {
    setSubTabState(next);
    const newParams = new URLSearchParams(searchParams);
    if (next === "socials") {
      newParams.set("subtab", "socials");
    } else {
      newParams.delete("subtab");
    }
    setSearchParams(newParams);
  }

  return (
    <div className="hero-socials-wrapper">
      <div style={{ marginBottom: "18px" }}>
        <SegmentedControl
          ariaLabel="Hero & Socials section"
          className="developer-settings-subtabs"
          onChange={setSubTab}
          options={SUB_TAB_OPTIONS}
          value={subTab}
        />
      </div>

      {subTab === "sliders" && <HeroSliderTab />}
      {subTab === "socials" && <ContactSocialTab />}
    </div>
  );
}
