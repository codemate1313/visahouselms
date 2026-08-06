export interface BlogListItem {
  id: number;
  title: string;
  slug: string;
  summary: string;
  category: string;
  author_name: string;
  read_time_minutes: number;
  featured_image_url?: string;
  created_at: string;
}
