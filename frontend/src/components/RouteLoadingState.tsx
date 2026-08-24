interface RouteLoadingStateProps {
  label?: string;
}

export function RouteLoadingState({ label = "Loading..." }: RouteLoadingStateProps) {
  return (
    <div className="route-loading-state" role="status" aria-live="polite" aria-label={label}>
      <span className="route-loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
