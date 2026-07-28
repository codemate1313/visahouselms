import { SUBSCRIPTION_STATE_BADGES } from "@/constants";
import { subscriptionsStrings as strings } from "./Subscriptions.strings";

export const STATE_BADGES = SUBSCRIPTION_STATE_BADGES;

export function stateLabel(state: string): string {
  const labels = strings.state;
  return labels[state as keyof typeof labels] ?? state;
}
