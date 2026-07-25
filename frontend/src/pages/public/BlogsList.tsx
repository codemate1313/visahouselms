import { StaticDcPage } from "./StaticDcPage";
import { blogsListStrings as strings } from "./BlogsList.strings";

export function BlogsList() {
  return <StaticDcPage fileName={strings.fileName} title={strings.title} />;
}
