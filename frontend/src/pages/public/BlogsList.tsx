import { useEffect, useState } from "react";
import { StaticDcPage } from "./StaticDcPage";
import { blogsListStrings as strings } from "./BlogsList.strings";
import { API_BASE_URL } from "@/api/client";

export function BlogsList() {
  const [bootstrap, setBootstrap] = useState<{ blogs?: unknown[] } | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/blogs`)
      .then((res) => (res.ok ? res.json() : []))
      .then((blogs) => {
        setBootstrap({ blogs });
        setPending(false);
      })
      .catch(() => {
        setPending(false);
      });
  }, []);

  return <StaticDcPage fileName={strings.fileName} title={strings.title} bootstrap={bootstrap} bootstrapPending={pending} />;
}
