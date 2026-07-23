import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSEO } from "../../hooks/useSEO";
import { API_BASE_URL } from "../../api/client";

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
    fetch(`${API_BASE_URL}/blogs/${slug}`)
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
    const lines = markdown.split(/\r?\n/);
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`}>
            {currentList.map((it, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(it) }} />
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushList();
        return;
      }

      if (trimmed.startsWith("- ")) {
        currentList.push(trimmed.substring(2));
      } else {
        flushList();
        if (trimmed.startsWith("# ")) {
          elements.push(<h1 key={index} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^#\s+/, "")) }} />);
        } else if (trimmed.startsWith("## ")) {
          elements.push(<h2 key={index} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^##\s+/, "")) }} />);
        } else if (trimmed.startsWith("### ")) {
          elements.push(<h3 key={index} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed.replace(/^###\s+/, "")) }} />);
        } else {
          elements.push(<p key={index} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(trimmed) }} />);
        }
      }
    });

    flushList();
    return elements;
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  };

  return (
    <div className="blog-detail-container">
      <Link to="/blogs" className="blog-back-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Back to All Articles
      </Link>

      <div className="blog-detail-header">
        <span className="blog-detail-badge">
          {post.category}
        </span>
        <h1 className="blog-detail-title">{post.title.replace('8. 0+', '8.0+')}</h1>

        <div className="blog-detail-meta">
          <div className="meta-item">
            <span className="meta-label">By</span>
            <span className="meta-value">{post.author_name}</span>
          </div>
          <span className="meta-dot">•</span>
          <div className="meta-item">
            <span className="meta-value">{post.read_time_minutes} min read</span>
          </div>
          <span className="meta-dot">•</span>
          <div className="meta-item">
            <span className="meta-label">Published</span>
            <span className="meta-value">{new Date(post.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {post.featured_image_url && (
        <img src={post.featured_image_url} alt={post.title} className="blog-detail-hero-img" />
      )}

      <div className="blog-markdown-body">{renderMarkdownLines(post.content_markdown)}</div>
    </div>
  );
}
