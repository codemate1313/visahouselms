import { apiClient } from "@/api/client";
import { DEVELOPER_ACCESS_SLUG } from "@/config/developerAccess";
import { destinationFor } from "@/pages/Login/helpers";
import { useAuthStore } from "@/store/authStore";
import { useImpersonationStore } from "@/store/impersonationStore";

const slug = DEVELOPER_ACCESS_SLUG;

interface ImpersonateResponse {
  access_token: string;
  target: { id: number; name: string; email: string; role: string | null };
}

/**
 * Enter read-only impersonation of a user.
 *
 * Shared by every "view as" entry point so the token swap is defined once: the
 * developer's real session is stashed for the banner's exit, the read-only
 * token is applied, and the app reloads presenting as the target.
 */
export async function startImpersonation(userId: number | string): Promise<void> {
  const { data } = await apiClient.post<ImpersonateResponse>(`/developer/${slug}/impersonate/${userId}`);
  const auth = useAuthStore.getState();
  const originalToken = auth.accessToken;
  const originalUser = auth.user;
  if (!originalToken || !originalUser) throw new Error("No active session.");

  const [firstName, ...rest] = data.target.name.split(" ");
  const role = data.target.role ?? originalUser.role;
  const impersonatedUser = {
    ...originalUser,
    id: data.target.id,
    email: data.target.email,
    role,
    first_name: firstName || data.target.name,
    last_name: rest.join(" "),
    force_password_reset: false,
    is_owner: false,
  };

  useImpersonationStore.getState().begin({
    target: data.target,
    originalToken,
    originalUser,
    impersonatedToken: data.access_token,
    impersonatedUser,
  });

  auth.setSession(data.access_token, impersonatedUser);
  // Land on the target's own home, not the marketing lander that "/" resolves to.
  const home = destinationFor({ role, force_password_reset: false }) ?? "/";
  window.location.assign(home);
}
