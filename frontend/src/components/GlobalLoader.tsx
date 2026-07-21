import { useLoaderStore } from "../store/loaderStore";

export function GlobalLoader() {
  const isLoading = useLoaderStore((state) => state.isLoading);
  const message = useLoaderStore((state) => state.message);

  if (!isLoading) return null;

  return (
    <div className="global-3d-loader-backdrop" aria-label={message} role="status">
      {/* 1. Top Red Glowing Infinite Progress Accent */}
      <div className="global-top-progress-bar">
        <div className="global-progress-glow-infinite" />
      </div>

      {/* 2. Full-Screen Ambient Radial Glows */}
      <div className="glass-ambient-glow glow-1" />
      <div className="glass-ambient-glow glow-2" />

      {/* 3. Floating 3D Scene & Dynamic Changing Text */}
      <div className="glass-free-content">
        <div className="loader-3d-scene">
          <div className="ring-3d ring-outer" />
          <div className="ring-3d ring-middle" />
          <div className="ring-3d ring-inner" />
          <div className="core-3d-sphere" />
        </div>

        <div className="loader-text-wrapper">
          <p key={message} className="loader-event-text">
            {message}
          </p>
          <div className="loader-wave-bar">
            <span className="wave-bar-fill-infinite" />
          </div>
          <div className="loader-dots">
            <span className="dot-pulse d1" />
            <span className="dot-pulse d2" />
            <span className="dot-pulse d3" />
          </div>
        </div>
      </div>
    </div>
  );
}
