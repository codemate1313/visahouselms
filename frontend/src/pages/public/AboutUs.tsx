import { StaticDcPage } from "./StaticDcPage";
import { aboutUsStrings as strings } from "./AboutUs.strings";

export function AboutUs() {
  return <StaticDcPage fileName={strings.fileName} title={strings.title} />;
}
