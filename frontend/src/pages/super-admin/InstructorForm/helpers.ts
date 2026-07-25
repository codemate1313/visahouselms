import type { InstructorAccountCreated } from "@/api/types";

export function extractTemporaryPassword(data: InstructorAccountCreated): string {
  const response = data as InstructorAccountCreated & {
    temp_password?: string;
    temporaryPassword?: string;
  };
  return response.temporary_password || response.temp_password || response.temporaryPassword || "";
}
