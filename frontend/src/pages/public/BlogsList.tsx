import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSEO } from "../../hooks/useSEO";

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

  const categories = ["All", "Speaking Tips", "Reading Passages", "Writing Assessor", "General Guidance"];

  useEffect(() => {
    let url = "/api/v1/blogs";
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (selectedCategory && selectedCategory !== "All") params.append("category", selectedCategory);
    if (params.toString()) url += `?${params.toString()}`;

    setLoading(true);
    fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setBlogs(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [search, selectedCategory]);

  return (
    <div className="blogs-page-container">
      <div className="blogs-header">
        <span className="section-kicker">EXPERT KNOWLEDGE BASE</span>
        <h1 className="section-title">IELTS Preparation Articles &amp; Exam Insights</h1>
        <p className="section-subtitle">
          Proven strategies, Band 8+ essay structures, and examiner tips to accelerate your preparation.
        </p>
      </div>

      <div className="blogs-filter-bar">
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`schedule-timing-pill ${selectedCategory === cat ? "selected" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search articles, topics or tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="blogs-search-input"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading latest educational articles...</div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No articles found matching your criteria. Try clearing search or selecting another category.
        </div>
      ) : (
        <div className="blogs-grid">
          {blogs.map((b) => (
            <Link key={b.id} to={`/blogs/${b.slug}`} className="blog-card">
              <div className="blog-image-wrap">
                <img
                  src={b.featured_image_url || "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&auto=format&fit=crop&q=80"}
                  alt={b.title}
                />
                <span className="blog-category-badge">{b.category}</span>
              </div>
              <div className="blog-content-body">
                <h3 className="blog-card-title">{b.title}</h3>
                <p className="blog-card-summary">{b.summary}</p>
                <div className="blog-card-footer">
                  <span>By {b.author_name}</span>
                  <span>{b.read_time_minutes} min read</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
