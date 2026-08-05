import { StaticDcPage } from "./StaticDcPage";
import { aboutUsStrings as strings } from "./AboutUs.strings";
import { useContactSettings } from "./useContactSettings";

export function AboutUs() {
  const contactSettings = useContactSettings();
  return <StaticDcPage fileName={strings.fileName} title={strings.title} bootstrap={{ contactSettings }} />;
}
