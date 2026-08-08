export const sessionsStrings = {
  title: "Active Sessions",
  signOutOthers: "Sign out other sessions",
  loading: "Loading...",
  table: {
    device: "Device",
    ipAddress: "IP Address",
    location: "Approx Location",
    signedIn: "Signed in",
    expires: "Expires",
    actions: "Actions",
  },
  unknownLocation: "Unknown",
  thisSession: "this session",
  unknownDevice: "Unknown device",
  revokeSession: "Revoke session",
  errors: {
    load: "Failed to load sessions.",
    revoke: "Failed to revoke session.",
    revokeOthers: "Failed to revoke other sessions.",
  },
  revokedOthers: (count: number) => `Revoked ${count} other session${count === 1 ? "" : "s"}.`,
} as const;
