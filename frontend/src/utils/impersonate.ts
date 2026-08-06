import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { useImpersonationStore } from "@/store/impersonationStore";

const slug = import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || "vh-control-9f4c2a";

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

  useImpersonationStore.getState().begin({ target: data.target, originalToken, originalUser });

  const [firstName, ...rest] = data.target.name.split(" ");
  auth.setSession(data.access_token, {
    ...originalUser,
    id: data.target.id,
    email: data.target.email,
    role: data.target.role ?? originalUser.role,
    first_name: firstName || data.target.name,
    last_name: rest.join(" "),
    is_owner: false,
  });
  window.location.assign("/");
}
