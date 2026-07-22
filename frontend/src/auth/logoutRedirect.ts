const LOGOUT_REDIRECT_KEY = "ielts_lms_logout_redirect";

export function markLogoutRedirect() {
  sessionStorage.setItem(LOGOUT_REDIRECT_KEY, "1");
}

export function shouldRedirectHomeAfterLogout() {
  return sessionStorage.getItem(LOGOUT_REDIRECT_KEY) === "1";
}

export function consumeLogoutRedirect() {
  const active = shouldRedirectHomeAfterLogout();
  if (active) {
    sessionStorage.removeItem(LOGOUT_REDIRECT_KEY);
  }
  return active;
}
