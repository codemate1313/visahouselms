const DEVICE_ID_KEY = "ielts-lms-device-id";

function createDeviceId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // Some privacy modes expose crypto but block calls to it.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

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
  let deviceId: string | null = null;
  try {
    deviceId = localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    // The server's HTTP-only cookie keeps identity stable when storage is blocked.
  }
  if (!deviceId || deviceId.length < 16 || deviceId.length > 200) {
    deviceId = createDeviceId();
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch {
      // Login can continue with the generated ID and server cookie fallback.
    }
  }
  const userAgent = navigator.userAgent;
  return {
    device_id: deviceId,
    device_name: `${browserName(userAgent)} on ${operatingSystem(userAgent)}`,
  };
}
