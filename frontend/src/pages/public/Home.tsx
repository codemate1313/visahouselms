import { useEffect, useState } from "react";
import { StaticDcPage } from "./StaticDcPage";
import { homeStrings as strings } from "./Home.strings";
import { API_BASE_URL } from "@/api/client";
import type { PublicContactSettings } from "./useContactSettings";

export function Home() {
  const [bootstrap, setBootstrap] = useState<{ testimonials?: unknown[]; blogs?: unknown[]; contactSettings?: PublicContactSettings } | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/testimonials`).then((res) => (res.ok ? res.json() : [])).catch(() => []),
      fetch(`${API_BASE_URL}/blogs`).then((res) => (res.ok ? res.json() : [])).catch(() => []),
      fetch(`${API_BASE_URL}/contact-settings`).then((res) => (res.ok ? res.json() : null)).catch(() => null),
    ]).then(([testimonials, blogs, contactSettings]) => {
      setBootstrap({ testimonials, blogs, contactSettings });
      setPending(false);
    });
  }, []);

  return <StaticDcPage fileName={strings.fileName} title={strings.title} bootstrap={bootstrap} bootstrapPending={pending} />;
}
