import { useEffect } from "react";
import { apiClient } from "../api/client";

interface PushWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
  vapidKey: string;
}

let initPromise: Promise<void> | null = null;

async function loadWebConfig(): Promise<PushWebConfig | null> {
  const { data } = await apiClient.get<{ config: PushWebConfig | null }>("/notifications/push/config", {
    headers: { "X-Skip-Loader": "1" },
  });
  return data.config;
}

async function registerForPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
  if (Notification.permission === "denied") return;

  const config = await loadWebConfig().catch(() => null);
  if (!config) return;

  const { initializeApp } = await import("firebase/app");
  const { getMessaging, getToken } = await import("firebase/messaging");

  const swParams = new URLSearchParams({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${swParams.toString()}`);

  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") return;

  const app = initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
  if (!token) return;

  await apiClient.post(
    "/notifications/push/device-token",
    { token, platform: "web" },
    { headers: { "X-Skip-Loader": "1" } },
  );
}

/** Registers this browser for FCM push once per session, best-effort. No-ops
 * silently if FCM isn't configured, the browser doesn't support push, or the
 * user declines/has declined the permission prompt. */
export function usePushNotifications(userId: number | string | undefined): void {
  useEffect(() => {
    if (!userId) return;
    initPromise ??= registerForPush().catch(() => undefined);
  }, [userId]);
}
