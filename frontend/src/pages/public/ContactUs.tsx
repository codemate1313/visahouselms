import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { StaticDcPage } from "./StaticDcPage";
import { contactUsStrings as strings } from "./ContactUs.strings";

export function ContactUs() {
  const location = useLocation();
  const bootstrap = useMemo(() => ({ search: location.search }), [location.search]);
  return <StaticDcPage fileName={strings.fileName} title={strings.title} bootstrap={bootstrap} />;
}
