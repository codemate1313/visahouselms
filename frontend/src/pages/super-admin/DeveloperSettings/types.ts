export type Tab = "typography" | "smtp" | "fcm" | "avatar" | "ai" | "payment-gateways" | "maintenance" | "backups" | "seed" | "slider" | "contact";


export interface BackupRow {
  id: number;
  filename: string;
  size_bytes: number | null;
  kind: string;
  status: string;
  created_at: string;
}

export type SocialPlatform =
  | "linkedin"
  | "github"
  | "instagram"
  | "youtube"
  | "facebook"
  | "twitter"
  | "tiktok"
  | "website";

export interface SocialLinkRow {
  id: number;
  platform: SocialPlatform;
  url: string;
  is_enabled: boolean;
  created_at: string;
}

export interface ContactInfo {
  id: number;
  email: string;
  email_note: string | null;
  phone: string;
  phone_note: string | null;
  support_url: string;
  support_note: string | null;
  office_name: string;
  office_address: string;
  updated_at: string | null;
}
