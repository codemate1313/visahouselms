import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { PublicOrbBackground } from "@/components/publicSite/PublicOrbBackground";
import { useRevealOnScroll } from "@/components/publicSite/useRevealOnScroll";
import { useSEO } from "@/hooks/useSEO";
import { API_BASE_URL } from "@/api/client";
import { useContactSettings } from "./useContactSettings";
import type { BlogListItem } from "./blogTypes";
import "@/styles/public/chrome.css";
import "@/styles/public/blogs.css";

const CATEGORIES = ["All", "Strategy", "Writing", "Speaking", "Listening", "Reading", "Institute", "News"];

function formatBlogDate(createdAt: string) {
  const date = createdAt ? new Date(createdAt) : new Date();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BlogsList() {
  useSEO({ title: "Blogs", description: "Band-boosting strategies, product notes and Language CERT news — written by trainers who mark hundreds of scripts a week." });
  const contactSettings = useContactSettings();
  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const rootRef = useRef<HTMLDivElement | null>(null);
  useRevealOnScroll(rootRef);

  useEffect(() => {
    fetch(`${API_BASE_URL}/blogs`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setBlogs(Array.isArray(data) ? data : []))
      .catch(() => setBlogs([]));
  }, []);

  const visibleBlogs = blogs.filter(
    (post) => activeCategory === "All" || (post.category && post.category.toLowerCase().includes(activeCategory.toLowerCase())),
  );

  return (
    <div className="vh-public" ref={rootRef}>
      <PublicOrbBackground />
      <div className="vh-page-content">
        <PublicHeader />

        <section className="vh-page-hero">
          <h1>
            Fresh from
            <span className="vh-accent"> our examiners.</span>
          </h1>
          <p>Band-boosting strategies, product notes and Language cert news — written by trainers who mark hundreds of scripts a week.</p>
        </section>

        <section className="vh-blog-categories vh-reveal">
          {CATEGORIES.map((label) => (
            <button
              key={label}
              type="button"
              className={`vh-blog-pill${activeCategory === label ? " vh-blog-pill-active" : ""}`}
              onClick={() => setActiveCategory(label)}
            >
              {label}
            </button>
          ))}
        </section>

        <section className="vh-blog-grid-section vh-reveal">
          {visibleBlogs.length > 0 ? (
            <div className="vh-blog-grid">
              {visibleBlogs.map((post) => (
                <Link key={post.id} to={`/blogs/${post.slug}`} className="vh-blog-card vh-reveal">
                  <div className="vh-blog-card-image">
                    <img
                      src={post.featured_image_url || "/images/blog/writing.jpg"}
                      alt={post.title}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.src = "/images/blog/writing.jpg";
                      }}
                    />
                  </div>
                  <div className="vh-blog-card-body">
                    <div className="vh-blog-card-category">{post.category || "General"}</div>
                    <h3 className="vh-blog-card-title">{post.title}</h3>
                    <p className="vh-blog-card-summary">{post.summary}</p>
                    <div className="vh-blog-card-meta">
                      <span>
                        {post.author_name || "Editorial Team"} · {formatBlogDate(post.created_at)}
                      </span>
                      <span>{post.read_time_minutes || 5} min read</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="vh-blog-empty">
              {activeCategory === "All" ? "No blog posts yet — check back soon." : `No posts in ${activeCategory} yet — try another category.`}
            </div>
          )}
        </section>

        <section className="vh-blog-newsletter-section vh-reveal">
          <div className="vh-blog-newsletter">
            <h2>Get one strategy every Friday</h2>
            <p>Short, examiner-written, no fluff.</p>
            <div className="vh-blog-newsletter-form">
              <input type="email" placeholder="you@example.com" />
              <button type="button">Subscribe</button>
            </div>
          </div>
        </section>

        <PublicFooter socialLinks={contactSettings?.social_links} />
      </div>
    </div>
  );
}
