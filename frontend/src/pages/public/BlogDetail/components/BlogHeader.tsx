import { blogDetailStrings as strings } from "../BlogDetail.strings";
import type { BlogPostDetail } from "../types";
import { formatDate } from "@/utils/date";

interface BlogHeaderProps {
  post: BlogPostDetail;
}

export function BlogHeader({ post }: BlogHeaderProps) {
  return (
    <div className="blog-detail-header">
      <span className="blog-detail-badge">{post.category}</span>
      <h1 className="blog-detail-title">{post.title.replace("8. 0+", "8.0+")}</h1>

      <div className="blog-detail-meta">
        <div className="meta-item">
          <span className="meta-label">{strings.meta.byLabel}</span>
          <span className="meta-value">{post.author_name}</span>
        </div>
        <span className="meta-dot">•</span>
        <div className="meta-item">
          <span className="meta-value">{strings.meta.readTime(post.read_time_minutes)}</span>
        </div>
        <span className="meta-dot">•</span>
        <div className="meta-item">
          <span className="meta-label">{strings.meta.publishedLabel}</span>
          <span className="meta-value">{formatDate(post.created_at)}</span>
        </div>
      </div>
    </div>
  );
}
