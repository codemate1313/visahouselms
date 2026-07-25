import { StaticDcPage } from "./StaticDcPage";
import { contactUsStrings as strings } from "./ContactUs.strings";

export function ContactUs() {
  return <StaticDcPage fileName={strings.fileName} title={strings.title} />;
}
