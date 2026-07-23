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
    <div className="blogs-page-container" style={{ padding: "80px 5%", backgroundColor: "var(--background)", minHeight: "100vh" }}>
      <div className="blogs-header text-center" style={{ marginBottom: "60px" }}>
        <span className="section-kicker" style={{ color: "var(--primary)", fontWeight: "bold", letterSpacing: "1px", textTransform: "uppercase", fontSize: "0.85rem" }}>EXPERT KNOWLEDGE BASE</span>
        <h1 className="section-title" style={{ fontSize: "2.5rem", fontWeight: "800", color: "var(--text)", marginTop: "10px" }}>IELTS Preparation Articles &amp; Insights</h1>
        <p className="section-subtitle" style={{ color: "var(--text-muted)", marginTop: "15px", maxWidth: "600px", margin: "15px auto 0" }}>
          Proven strategies, Band 8+ essay structures, and examiner tips to accelerate your preparation.
        </p>
      </div>

      <div className="blogs-filter-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "80px", flexWrap: "wrap", gap: "30px" }}>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`schedule-timing-pill ${selectedCategory === cat ? "selected" : ""}`}
              onClick={() => setSelectedCategory(cat)}
              style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid var(--border)", backgroundColor: selectedCategory === cat ? "var(--primary)" : "var(--surface)", color: selectedCategory === cat ? "white" : "var(--text)", cursor: "pointer", transition: "all 0.2s font-weight: 600", fontSize: "0.9rem" }}
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
        <div className="blogs-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "30px" }}>
          {blogs.map((b) => (
            <Link key={b.id} to={`/blogs/${b.slug}`} className="blog-card" style={{ textDecoration: "none", backgroundColor: "var(--glass-bg)", border: "1px solid var(--border)", borderRadius: "20px", overflow: "hidden", display: "flex", flexDirection: "column", transition: "transform 0.3s ease, box-shadow 0.3s ease" }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-8px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(0,0,0,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div className="blog-image-wrap" style={{ position: "relative", height: "220px", overflow: "hidden" }}>
                <img
                  src={b.featured_image_url || "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80"}
                  alt={b.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <span className="blog-category-badge" style={{ position: "absolute", top: "15px", left: "15px", backgroundColor: "rgba(255, 255, 255, 0.9)", padding: "5px 12px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold", color: "var(--primary)" }}>{b.category}</span>
              </div>
              <div className="blog-content-body" style={{ padding: "25px", display: "flex", flexDirection: "column", flexGrow: 1 }}>
                <h3 className="blog-card-title" style={{ fontSize: "1.3rem", fontWeight: "700", color: "var(--text)", marginBottom: "10px", lineHeight: "1.4" }}>{b.title}</h3>
                <p className="blog-card-summary" style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "20px", flexGrow: 1 }}>{b.summary.substring(0, 120)}...</p>
                
                <div className="blog-card-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "var(--primary-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "0.8rem" }}>
                      {b.author_name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: "var(--text)" }}>{b.author_name}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{new Date(b.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
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
