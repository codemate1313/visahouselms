import { subscriptionsStrings as strings } from "./Subscriptions.strings";

export const STATE_BADGES: Record<string, string> = {
  active: "badge-green",
  grace: "badge-amber",
  expired: "badge-red",
  cancelled: "badge-gray",
  none: "badge-gray",
};

export function stateLabel(state: string): string {
  const labels = strings.state;
  return labels[state as keyof typeof labels] ?? state;
}
