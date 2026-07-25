export interface BlogRecord extends BlogFormData {
  id: number;
}

export interface BlogFormData {
  title: string;
  slug: string;
  summary: string;
  content_markdown: string;
  featured_image_url: string;
  category: string;
  tags: string;
  author_name: string;
  read_time_minutes: number;
  is_published: boolean;
  meta_title: string;
  meta_description: string;
}
