import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { PublicOrbBackground } from "@/components/publicSite/PublicOrbBackground";
import { useRevealOnScroll } from "@/components/publicSite/useRevealOnScroll";
import { useSEO } from "@/hooks/useSEO";
import { API_BASE_URL } from "@/api/client";
import { useToastStore } from "@/store/toastStore";
import { blogDetailStrings as strings } from "./BlogDetail.strings";
import type { BlogPostDetail } from "./types";
import type { BlogListItem } from "../blogTypes";
import { BlogMarkdownBody } from "./components/BlogMarkdownBody";
import { Button } from "@/components/ui/Button/Button";
import "@/styles/public/chrome.css";
import "@/styles/public/blogs.css";

export type { BlogPostDetail } from "./types";

function formatBlogDate(createdAt?: string) {
  if (!createdAt) return "Recent";
  const date = new Date(createdAt);
  return date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [relatedPosts, setRelatedPosts] = useState<BlogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [readingProgress, setReadingProgress] = useState(0);

  const rootRef = useRef<HTMLDivElement | null>(null);
  useRevealOnScroll(rootRef);

  useSEO({
    title: post?.meta_title || post?.title || strings.seo.fallbackTitle,
    description: post?.meta_description || post?.summary || "",
    keywords: post?.tags || strings.seo.fallbackKeywords,
    ogImage: post?.featured_image_url,
  });

  // Track reading progress percentage
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight <= 0) return;
      const progress = (window.scrollY / totalHeight) * 100;
      setReadingProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch current blog post
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

  // Fetch related posts
  useEffect(() => {
    fetch(`${API_BASE_URL}/blogs`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: BlogListItem[]) => {
        if (Array.isArray(data)) {
          const others = data.filter((b) => b.slug !== slug).slice(0, 3);
          setRelatedPosts(others);
        }
      })
      .catch(() => setRelatedPosts([]));
  }, [slug]);

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      useToastStore.getState().showSuccess("Article link copied to clipboard!");
    }
  };

  const handleShareTwitter = () => {
    if (!post) return;
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(post.title);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer");
  };

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="vh-public">
        <PublicOrbBackground />
        <div className="vh-page-content">
          <PublicHeader />
          <div className="vh-blog-article-wrapper text-center py-36" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
            <div style={{ color: "var(--ink2)", fontSize: "16px", fontWeight: 500 }}>{strings.loading}</div>
          </div>
          <PublicFooter />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="vh-public">
        <PublicOrbBackground />
        <div className="vh-page-content">
          <PublicHeader />
          <div className="vh-blog-article-wrapper text-center py-28" style={{ minHeight: "60vh" }}>
            <h2 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "12px", color: "var(--ink)" }}>{strings.notFound.title}</h2>
            <p style={{ color: "var(--ink2)", marginBottom: "24px", fontSize: "15px" }}>{strings.notFound.description}</p>
            <Link to="/blogs" className="vh-blog-back-link-btn">
              {strings.notFound.backLink}
            </Link>
          </div>
          <PublicFooter />
        </div>
      </div>
    );
  }

  const tagsList = post.tags ? post.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const authorInitials = post.author_name
    ? post.author_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "VH";

  const heroImageSrc = post.featured_image_url || "/images/blog/featured.jpg";

  return (
    <div className="vh-public vh-blog-detail-page" ref={rootRef}>
      <div className="vh-blog-reading-progress" style={{ width: `${readingProgress}%` }} />
      <PublicOrbBackground />

      <div className="vh-page-content">
        <PublicHeader />

        {/* Top Breadcrumb Bar */}
        <div className="vh-blog-top-bar">
          <div className="vh-blog-top-bar-inner">
            <nav className="vh-blog-breadcrumbs" aria-label="Breadcrumbs">
              <Link to="/">Home</Link>
              <span className="vh-sep">→</span>
              <Link to="/blogs">Insights & Blogs</Link>
              <span className="vh-sep">→</span>
              <span className="vh-curr">{post.title}</span>
            </nav>
          </div>
        </div>

        {/* Full-Screen Centered Hero Banner */}
        <section className="vh-blog-detail-hero">
          <div className="vh-blog-detail-hero-bg">
            <img
              src={heroImageSrc}
              alt={post.title}
              className="vh-blog-detail-hero-img"
              onError={(e) => {
                e.currentTarget.src = "/images/blog/featured.jpg";
              }}
            />
            <div className="vh-blog-detail-hero-overlay" />
          </div>

          <div className="vh-blog-hero-content-centered">
            {/* Centered Yellow Meta */}
            <div className="vh-blog-hero-meta-centered">
              <span>{formatBlogDate(post.created_at)}</span>
              <span className="vh-blog-meta-sep">·</span>
              <span>{post.read_time_minutes || 5} min read</span>
            </div>

            {/* Main Centered Headline */}
            <h1 className="vh-blog-hero-title-centered">
              {post.title.replace("8. 0+", "8.0+")}
            </h1>
          </div>
        </section>

        {/* Article Prose Content */}
        <article className="vh-blog-article-wrapper">
          {/* Author info and share buttons header */}
          <div className="vh-blog-article-header-meta">
            <div className="vh-blog-author-info-block">
              <div className="vh-blog-author-avatar">
                <span>{authorInitials}</span>
              </div>
              <div className="vh-blog-author-details">
                <span className="vh-blog-author-name">{post.author_name || "Visa House Academic Team"}</span>
                <span className="vh-blog-author-role">
                  {post.category ? `${post.category} • ` : ""}LanguageCert Senior Trainer
                </span>
              </div>
            </div>

            <div className="vh-blog-share-actions">
              <Button type="button" variant="ghost" className="vh-blog-share-btn" onClick={handleCopyLink} title="Copy Link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Share
              </Button>
              <Button type="button" variant="ghost" className="vh-blog-share-btn" onClick={handleShareLinkedIn} title="Share on LinkedIn">
                LinkedIn
              </Button>
              <Button type="button" variant="ghost" className="vh-blog-share-btn" onClick={handleShareTwitter} title="Share on X">
                X
              </Button>
            </div>
          </div>

          <BlogMarkdownBody markdown={post.content_markdown || post.summary} />

          {/* Article Footer with Tags & Author Bio */}
          <footer className="vh-blog-article-footer">
            {tagsList.length > 0 && (
              <div className="vh-blog-tags-wrapper">
                <span className="vh-blog-tags-label">Tags:</span>
                {tagsList.map((tag) => (
                  <span key={tag} className="vh-blog-tag-pill">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="vh-blog-author-bio-card">
              <div className="vh-blog-author-bio-avatar">
                <span>{authorInitials}</span>
              </div>
              <div className="vh-blog-author-bio-content">
                <h3>{post.author_name || "Visa House Academic Team"}</h3>
                <p>
                  Senior LanguageCert Examiner & IELTS Curriculum Specialist at Visa House. Dedicated to helping candidates achieve high band scores through structured test simulation and strategic feedback.
                </p>
              </div>
            </div>
          </footer>
        </article>

        {/* Related Articles Section */}
        {relatedPosts.length > 0 && (
          <section className="vh-blog-related-section vh-reveal">
            <div className="vh-blog-related-head">
              <h2>Related Articles</h2>
              <Link to="/blogs" className="vh-blog-back-link-btn">
                All articles →
              </Link>
            </div>

            <div className="vh-blog-grid">
              {relatedPosts.map((rel) => (
                <Link key={rel.id} to={`/blogs/${rel.slug}`} className="vh-blog-card">
                  <div className="vh-blog-card-image">
                    <img
                      src={rel.featured_image_url || "/images/blog/featured.jpg"}
                      alt={rel.title}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "/images/blog/featured.jpg";
                      }}
                    />
                  </div>
                  <div className="vh-blog-card-body">
                    <div className="vh-blog-card-category">{rel.category || "Strategy"}</div>
                    <h3 className="vh-blog-card-title">{rel.title}</h3>
                    <p className="vh-blog-card-summary">{rel.summary}</p>
                    <div className="vh-blog-card-meta">
                      <span>{formatBlogDate(rel.created_at)}</span>
                      <span>{rel.read_time_minutes || 5} min read</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <PublicFooter />
      </div>
    </div>
  );
}
