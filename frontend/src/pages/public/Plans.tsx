import { StaticDcPage } from "./StaticDcPage";
import { plansStrings as strings } from "./Plans.strings";

export function Plans() {
  return <StaticDcPage fileName={strings.fileName} title={strings.title} />;
}
