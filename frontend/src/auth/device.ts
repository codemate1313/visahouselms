const DEVICE_ID_KEY = "ielts-lms-device-id";

function browserName(userAgent: string): string {
  if (userAgent.includes("Edg/")) return "Edge";
  if (userAgent.includes("Chrome/")) return "Chrome";
  if (userAgent.includes("Firefox/")) return "Firefox";
  if (userAgent.includes("Safari/")) return "Safari";
  return "Browser";
}

function operatingSystem(userAgent: string): string {
  if (userAgent.includes("Windows")) return "Windows";
  if (userAgent.includes("Mac OS")) return "macOS";
  if (userAgent.includes("Android")) return "Android";
  if (/iPhone|iPad|iPod/.test(userAgent)) return "iOS";
  if (userAgent.includes("Linux")) return "Linux";
  return "Unknown OS";
}

export function getDeviceIdentity() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  const userAgent = navigator.userAgent;
  return {
    device_id: deviceId,
    device_name: `${browserName(userAgent)} on ${operatingSystem(userAgent)}`,
  };
}
