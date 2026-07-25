import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSEO } from "@/hooks/useSEO";
import { API_BASE_URL } from "@/api/client";
import { blogDetailStrings as strings } from "./BlogDetail.strings";
import type { BlogPostDetail } from "./types";
import { BlogHeader } from "./components/BlogHeader";
import { BlogMarkdownBody } from "./components/BlogMarkdownBody";

export type { BlogPostDetail } from "./types";

export function BlogDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useSEO({
    title: post?.meta_title || post?.title || strings.seo.fallbackTitle,
    description: post?.meta_description || post?.summary || "",
    keywords: post?.tags || strings.seo.fallbackKeywords,
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
    return <div className="text-center py-24 text-gray-500">{strings.loading}</div>;
  }

  if (!post) {
    return (
      <div className="blog-detail-container text-center py-24">
        <h2 className="text-2xl font-bold mb-4">{strings.notFound.title}</h2>
        <p className="text-gray-500 mb-6">{strings.notFound.description}</p>
        <Link to="/blogs" className="hero-primary-btn inline-block">
          {strings.notFound.backLink}
        </Link>
      </div>
    );
  }

  return (
    <div className="blog-detail-container">
      <Link to="/blogs" className="blog-back-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        {strings.backToAll}
      </Link>

      <BlogHeader post={post} />

      {post.featured_image_url && (
        <img src={post.featured_image_url} alt={post.title} className="blog-detail-hero-img" />
      )}

      <BlogMarkdownBody markdown={post.content_markdown} />
    </div>
  );
}
