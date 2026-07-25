export interface BlogAdminItem {
  id: number;
  title: string;
  slug: string;
  category: string;
  author_name: string;
  read_time_minutes: number;
  is_published: boolean;
  featured_image_url?: string;
  created_at: string;
}

export type BlogStatusFilter = "ALL" | "PUBLISHED" | "DRAFT";
export type BlogViewMode = "grid" | "table";
