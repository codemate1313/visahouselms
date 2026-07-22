import { revokeCurrentSession } from "../api/client";
import { markLogoutRedirect } from "./logoutRedirect";

export async function logoutAndRedirectHome(): Promise<void> {
  markLogoutRedirect();

  try {
    await revokeCurrentSession();
  } catch {
    // Local sign-out and the home redirect still happen if the API is unavailable.
  } finally {
    window.location.replace("/");
  }
}
