/* eslint-disable no-undef */
// Registered dynamically by src/push/pushNotifications.ts with the admin-configured
// Firebase Web config passed as query params (there's no build-time config to bake in
// here, since the project is set up at runtime via Developer Settings).
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (firebaseConfig.apiKey) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "IELTS LMS";
    const body = payload.notification?.body || "";
    const link = payload.fcmOptions?.link || payload.data?.link_url || "/";
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.svg",
      data: { link },
    });
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const link = event.notification.data?.link || "/";
    event.waitUntil(self.clients.openWindow(link));
  });
}
