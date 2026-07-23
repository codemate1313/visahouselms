import { useEffect, useState } from "react";
import { useLoaderStore } from "../store/loaderStore";

const LOADER_FLAGS = [
  { symbol: "🇨🇦", name: "Canada" },
  { symbol: "🇺🇸", name: "United States" },
  { symbol: "🇬🇧", name: "United Kingdom" },
  { symbol: "🇩🇪", name: "Germany" },
  { symbol: "🇦🇺", name: "Australia" },
  { symbol: "🇪🇺", name: "European Union" },
  {
    symbol: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
    name: "England",
  },
] as const;

export function GlobalLoader() {
  const isLoading = useLoaderStore((state) => state.isLoading);
  const message = useLoaderStore((state) => state.message);
  const [flagIndex, setFlagIndex] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setFlagIndex(0);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      setFlagIndex((current) => (current + 1) % LOADER_FLAGS.length);
    }, 650);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  if (!isLoading) return null;

  const flag = LOADER_FLAGS[flagIndex];

  return (
    <div
      className="global-3d-loader-backdrop"
      aria-label={message}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <div className="simple-loader-content">
        <div className="flag-loader-box" aria-hidden="true">
          <span key={flag.name} className="flag-loader-symbol">{flag.symbol}</span>
        </div>
        <p key={message} className="simple-loader-message">{message}</p>
      </div>
    </div>
  );
}
