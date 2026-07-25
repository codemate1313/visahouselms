import type { ExamModule } from "@/api/types";

export interface Assignment {
  id: number;
  institute_id: number;
  institute_name: string;
  is_active: boolean;
  assigned_at: string;
}

export interface ManagedModule extends ExamModule {
  assignments: Assignment[];
}

export interface Institute {
  id: number;
  name: string;
  is_active: boolean;
  onboarding_status: string;
}
