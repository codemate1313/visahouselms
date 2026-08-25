import { DEVELOPER_ACCESS_SLUG } from "@/config/developerAccess";
import type { RoleOption } from "./types";

export const ALL_ROLE_OPTIONS: readonly RoleOption[] = [
  { role: "INSTITUTE_ADMIN", label: "Institute", basePath: "/login" },
  { role: "INST_INSTRUCTOR", label: "Instructor", basePath: "/login?role=INST_INSTRUCTOR" },
  { role: "STUDENT", label: "Student", basePath: "/login?role=STUDENT" },
  { role: "SUPER_ADMIN", label: "Super Admin", basePath: "/login?role=SUPER_ADMIN" },
  { role: "SA_INSTRUCTOR", label: "SA Instructor", basePath: "/login?role=SA_INSTRUCTOR" },
  { role: "DEVELOPER", label: "Developer", basePath: `/${DEVELOPER_ACCESS_SLUG}/login` },
] as const;

export function roleLabel(role: string) {
  return ALL_ROLE_OPTIONS.find((option) => option.role === role)?.label ?? role;
}

export function destinationFor(user: { role: string; force_password_reset: boolean }) {
  if (user.role === "SUPER_ADMIN") return user.force_password_reset ? "/super-admin/change-password" : "/super-admin/dashboard";
  if (user.role === "SA_INSTRUCTOR") return user.force_password_reset ? "/super-admin/instructor/change-password" : "/super-admin/instructor/dashboard";
  if (user.role === "DEVELOPER") return user.force_password_reset ? `/${DEVELOPER_ACCESS_SLUG}/change-password` : `/${DEVELOPER_ACCESS_SLUG}/panel`;
  if (user.role === "INSTITUTE_ADMIN") return "/institute-portal";
  if (user.role === "INST_INSTRUCTOR") return user.force_password_reset ? "/institute-instructor/change-password" : "/institute-instructor/dashboard";
  if (user.role === "STUDENT") return "/student/dashboard";
  return null;
}
