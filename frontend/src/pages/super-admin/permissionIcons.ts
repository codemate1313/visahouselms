import type { IconName } from "@/components/icons";

export const PERMISSION_ICON_BY_KEY: Record<string, IconName> = {
  select_all: "overview",
  view_students: "user",
  manage_students: "edit",
  view_student_activity: "analytics",
  manage_student_sessions: "session",
  manage_staff: "instructors",
  view_billing: "subscription",
};

export function getPermissionIcon(key: string): IconName {
  return PERMISSION_ICON_BY_KEY[key] ?? "admin";
}
