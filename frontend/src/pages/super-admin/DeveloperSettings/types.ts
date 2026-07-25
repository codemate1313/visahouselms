export type Tab = "typography" | "smtp" | "fcm" | "avatar" | "ai" | "maintenance" | "backups" | "seed" | "slider";

export interface BackupRow {
  id: number;
  filename: string;
  size_bytes: number | null;
  kind: string;
  status: string;
  created_at: string;
}
