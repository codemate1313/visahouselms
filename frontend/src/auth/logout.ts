import { revokeCurrentSession } from "../api/client";
import { resetPushNotificationsInit } from "../hooks/usePushNotifications";
import { useImpersonationStore } from "../store/impersonationStore";
import { markLogoutRedirect } from "./logoutRedirect";

export async function logoutAndRedirectHome(): Promise<void> {
  markLogoutRedirect();

  // End any impersonation first so its localStorage record never survives an
  // explicit logout - otherwise the next page load's initializeSession()
  // would find `active: true` and silently sign back in as the impersonated
  // user instead of landing on the logged-out home page.
  useImpersonationStore.getState().end();
  resetPushNotificationsInit();

  try {
    await revokeCurrentSession();
  } catch {
    // Local sign-out and the home redirect still happen if the API is unavailable.
  } finally {
    window.location.replace("/");
  }
}
