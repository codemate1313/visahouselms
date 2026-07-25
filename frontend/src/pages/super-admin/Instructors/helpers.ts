import type { InstructorPasswordReset } from "@/api/types";

export function extractTemporaryPassword(data: InstructorPasswordReset): string {
  const response = data as InstructorPasswordReset & {
    temp_password?: string;
    temporaryPassword?: string;
  };
  return response.temporary_password || response.temp_password || response.temporaryPassword || "";
}
