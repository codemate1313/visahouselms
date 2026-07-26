export interface AiQuotaStudent {
  user_id: number;
  name: string;
  email: string;
  used: number;
  limit: number;
  remaining: number;
  exhausted: boolean;
}

export interface AiQuotaOverview {
  period: string;
  per_student_limit: number;
  /** "institute" when the Super Admin set a cap, "platform" when it falls back. */
  limit_source: "institute" | "platform";
  total_used: number;
  students: AiQuotaStudent[];
}
