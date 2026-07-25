export interface InstituteRow {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  logo_url: string | null;
  is_active: boolean;
  subscription_state: string;
  created_at: string;
  onboarding_status: "draft" | "published";
}

export type SortKey = "name" | "slug";
