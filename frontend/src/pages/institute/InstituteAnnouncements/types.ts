import type { TargetStudentOption } from "@/api/types";

export interface TargetOptions {
  students: TargetStudentOption[];
}

export interface AudienceCardOption {
  key: string;
  title: string;
  icon: string;
  desc: string;
}

export type AnnouncementStatus = "published" | "scheduled" | "draft";
