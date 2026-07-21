import { useLoaderStore } from "../store/loaderStore";

export function GlobalLoader() {
  const isLoading = useLoaderStore((state) => state.isLoading);
  const message = useLoaderStore((state) => state.message);

  if (!isLoading) return null;

  return (
    <div
      className="global-3d-loader-backdrop"
      aria-label={message}
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      <div className="simple-loader-content">
        <div className="color-dots-loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p key={message} className="simple-loader-message">{message}</p>
      </div>
    </div>
  );
}
