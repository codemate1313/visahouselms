export interface BlogPostDetail {
  id: number;
  title: string;
  slug: string;
  summary: string;
  content_markdown: string;
  featured_image_url?: string;
  category: string;
  tags?: string;
  author_name: string;
  read_time_minutes: number;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
}
