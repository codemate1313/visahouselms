import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSEO } from "../../hooks/useSEO";

import { API_BASE_URL, apiClient } from "../../api/client";

interface BlogPostItem {
  id: number;
  title: string;
  slug: string;
  summary: string;
  featured_image_url?: string;
  category: string;
  tags?: string;
  author_name: string;
  read_time_minutes: number;
  created_at: string;
}

export function BlogsList() {
  useSEO({
    title: "IELTS Preparation Blogs & Expert Exam Guides",
    description: "Read expert IELTS Preparation blogs, Speaking cue card guides, Writing Task 1 & 2 templates, and Reading strategies.",
    keywords: "IELTS Blog, IELTS Preparation, IELTS Speaking Guide, Writing Task 2 Templates",
  });

  const [blogs, setBlogs] = useState<BlogPostItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [loading, setLoading] = useState(true);

  const categories = ["All", "Platform Features", "Exam Strategies", "Platform Updates"];

  useEffect(() => {
    let url = `${API_BASE_URL}/blogs`;
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (selectedCategory && selectedCategory !== "All") params.append("category", selectedCategory);
    if (params.toString()) url += `?${params.toString()}`;

    setLoading(true);
    apiClient.get(url.replace(API_BASE_URL, ""))
      .then((res) => {
        setBlogs(res.data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [search, selectedCategory]);

  return (
    <div className="blogs-page-container" style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
      <div className="blogs-header text-center" style={{ marginBottom: "60px" }}>
        <span className="section-kicker" style={{ color: "var(--primary)", fontWeight: "bold", letterSpacing: "1px", textTransform: "uppercase", fontSize: "0.85rem" }}>EXPERT KNOWLEDGE BASE</span>
        <h1 className="section-title" style={{ fontSize: "2.5rem", fontWeight: "800", color: "var(--text)", marginTop: "10px" }}>IELTS Preparation Articles &amp; Insights</h1>
        <p className="section-subtitle" style={{ color: "var(--text-muted)", marginTop: "15px", maxWidth: "600px", margin: "15px auto 0" }}>
          Proven strategies, Band 8+ essay structures, and examiner tips to accelerate your preparation.
        </p>
      </div>

      <div className="blogs-filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "80px", flexWrap: "wrap", gap: "30px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`schedule-timing-pill ${selectedCategory === cat ? "selected" : ""}`}
              onClick={() => setSelectedCategory(cat)}
              style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid var(--border)", backgroundColor: selectedCategory === cat ? "var(--primary)" : "var(--surface)", color: selectedCategory === cat ? "var(--white)" : "var(--text)", cursor: "pointer", transition: "all 0.2s ease", fontWeight: 600, fontSize: "0.9rem" }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", minWidth: "300px" }}>
          <input
            type="text"
            placeholder="Search articles, topics or tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "10px 15px 10px 40px", borderRadius: "20px", border: "1px solid var(--border)", backgroundColor: "var(--surface-muted)", color: "var(--text)", outline: "none" }}
          />
          <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500" style={{ minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>Loading latest educational articles...</div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-12 text-gray-500" style={{ minHeight: "400px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          No articles found matching your criteria. Try clearing search or selecting another category.
        </div>
      ) : (
        <div className="blogs-grid">
          {blogs.map((b) => (
            <Link key={b.id} to={`/blogs/${b.slug}`} className="blog-card">
              <div className="blog-card-image-wrap">
                {b.featured_image_url ? (
                  <img src={b.featured_image_url} alt={b.title} loading="lazy" />
                ) : (
                  <div className="blog-card-image-empty">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    No Image
                  </div>
                )}
                <div className="blog-card-badge">{b.category}</div>
              </div>
              <div className="blog-card-body">
                <h3 className="blog-card-title">{b.title}</h3>
                <p className="blog-card-summary">{b.summary}</p>
                <div className="blog-card-footer">
                  <div className="blog-card-author">
                    <div className="blog-card-avatar">{b.author_name.charAt(0)}</div>
                    <div className="blog-card-author-meta">
                      <div className="blog-card-author-name">{b.author_name}</div>
                      <div className="blog-card-author-date">{new Date(b.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="blog-card-readtime">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    {b.read_time_minutes} min
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
