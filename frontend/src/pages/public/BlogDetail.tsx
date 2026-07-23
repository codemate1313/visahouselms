import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSEO } from "../../hooks/useSEO";

interface BlogPostDetail {
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

export function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: post?.meta_title || post?.title || "IELTS Blog Article",
    description: post?.meta_description || post?.summary || "",
    keywords: post?.tags || "IELTS, Preparation",
    ogImage: post?.featured_image_url,
  });

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/v1/blogs/${slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setPost(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return <div className="text-center py-24 text-gray-500">Loading article details...</div>;
  }

  if (!post) {
    return (
      <div className="blog-detail-container text-center py-24">
        <h2 className="text-2xl font-bold mb-4">Article Not Found</h2>
        <p className="text-gray-500 mb-6">The blog article you are looking for might have been moved or removed.</p>
        <Link to="/blogs" className="hero-primary-btn inline-block">
          ← Back to Blogs
        </Link>
      </div>
    );
  }

  // Simple HTML renderer helper for markdown paragraphs and headings
  const renderMarkdownLines = (markdown: string) => {
    return markdown.split("\n\n").map((chunk, idx) => {
      const trimmed = chunk.trim();
      if (trimmed.startsWith("# ")) {
        return <h1 key={idx}>{trimmed.replace("# ", "")}</h1>;
      }
      if (trimmed.startsWith("## ")) {
        return <h2 key={idx}>{trimmed.replace("## ", "")}</h2>;
      }
      if (trimmed.startsWith("### ")) {
        return <h3 key={idx}>{trimmed.replace("### ", "")}</h3>;
      }
      if (trimmed.startsWith("- ")) {
        const items = trimmed.split("\n- ").map((item) => item.replace("- ", ""));
        return (
          <ul key={idx}>
            {items.map((it, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(it) }} />
            ))}
          </ul>
        );
      }
      return <p key={idx} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />;
    });
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  };

  return (
    <div className="blog-detail-container">
      <Link to="/blogs" className="text-sm font-semibold text-rose-600 hover:underline mb-6 inline-block">
        ← Back to All Articles
      </Link>

      <div className="blog-detail-header">
        <span className="blog-category-badge" style={{ position: "static" }}>
          {post.category}
        </span>
        <h1 className="blog-detail-title">{post.title}</h1>

        <div className="blog-detail-meta">
          <span>By {post.author_name}</span>
          <span>•</span>
          <span>{post.read_time_minutes} min read</span>
          <span>•</span>
          <span>Published {new Date(post.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {post.featured_image_url && (
        <img src={post.featured_image_url} alt={post.title} className="blog-detail-hero-img" />
      )}

      <div className="blog-markdown-body">{renderMarkdownLines(post.content_markdown)}</div>
    </div>
  );
}
