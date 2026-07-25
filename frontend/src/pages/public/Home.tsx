import { StaticDcPage } from "./StaticDcPage";
import { homeStrings as strings } from "./Home.strings";

export function Home() {
  return <StaticDcPage fileName={strings.fileName} title={strings.title} />;
}
