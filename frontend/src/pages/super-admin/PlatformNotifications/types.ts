import type { TargetInstituteOption, TargetStudentOption } from "@/api/types";
import type { IconName } from "@/components/icons";

export interface TargetOptions {
  institutes: TargetInstituteOption[];
  students: TargetStudentOption[];
}

export interface AudienceCardOption {
  key: string;
  title: string;
  iconName: IconName;
  desc: string;
}

export type NotificationStatus = "published" | "scheduled" | "draft";
export type HistoryStatusFilter = "ALL" | "PUBLISHED" | "SCHEDULED" | "DRAFT";
