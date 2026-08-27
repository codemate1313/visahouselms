import { useEffect, useState } from "react";
import { grammarContentApi, type GrammarContentItem } from "@/api/grammarContentApi";
import { Icon } from "@/components/icons";
import { Badge, Button } from "@/components/ui";
import "./StudyMaterialPage.css";

export function StudyMaterialPage() {
  const [materials, setMaterials] = useState<GrammarContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Layout States
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const res = await grammarContentApi.getStudentStudyMaterials();
        setMaterials(res.items);
      } catch (err: any) {
        setError(err?.response?.data?.detail || "Failed to load study materials.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Filtered materials
  const filteredMaterials = materials.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      item.file_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="sm-container">
      {error && (
        <div
          className="error-banner"
          style={{
            padding: "12px 16px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "10px",
            color: "#dc2626",
          }}
        >
          {error}
        </div>
      )}

      {/* Controls & Search Bar */}
      <div className="sm-controls-bar">
        <div className="sm-search-box">
          <Icon name="search" className="sm-search-icon" />
          <input
            type="text"
            className="sm-search-input"
            placeholder="Search study materials by title or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "var(--text-muted, #6e6e73)", fontWeight: 500 }}>
            Showing {filteredMaterials.length} of {materials.length}
          </span>
          <div className="sm-view-toggle">
            <button
              type="button"
              className={`sm-view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              Grid
            </button>
            <button
              type="button"
              className={`sm-view-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Material Display */}
      {loading ? (
        <div className="sm-loading-container">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sm-skeleton-card">
              <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                <div className="sm-skeleton-bar" style={{ width: "46px", height: "46px", borderRadius: "12px", flexShrink: 0 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div className="sm-skeleton-bar" style={{ width: "65%", height: "18px" }} />
                  <div className="sm-skeleton-bar" style={{ width: "40%", height: "14px" }} />
                </div>
              </div>
              <div className="sm-skeleton-bar" style={{ width: "90%", height: "14px", marginTop: "12px" }} />
              <div className="sm-skeleton-bar" style={{ width: "100%", height: "38px", marginTop: "auto" }} />
            </div>
          ))}
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="sm-empty-state">
          <div className="sm-empty-illustration">
            <div className="sm-empty-glow-orb" />
            <div className="sm-empty-icon-box">
              {search ? (
                <Icon name="search" className="sm-empty-icon-main" />
              ) : (
                <Icon name="filePdf" className="sm-empty-icon-main" />
              )}
            </div>
          </div>
          <span className="sm-empty-pill">
            {search ? "No Matches Found" : "Library Empty"}
          </span>
          <h3 className="sm-empty-title">
            {search ? `No study materials match "${search}"` : "No Study Material Available Yet"}
          </h3>
          <p className="sm-empty-desc">
            {search
              ? "We couldn't find any resources matching your search query. Try checking for typos or searching for a broader keyword."
              : "Your instructor has not published any grammar study materials or PDF guides yet. Check back soon for new updates!"}
          </p>
          {search && (
            <div className="sm-empty-actions">
              <Button variant="secondary" onClick={() => setSearch("")} style={{ gap: "6px" }}>
                <Icon name="cross" /> Clear Search Filter
              </Button>
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="sm-grid">
          {filteredMaterials.map((item) => (
            <div key={item.id} className="sm-card">
              <div>
                <div className="sm-card-top">
                  <div className="sm-pdf-icon-wrapper">
                    <Icon name="filePdf" />
                  </div>
                  <div className="sm-card-meta-head">
                    <h3 className="sm-card-title">{item.title}</h3>
                    <div className="sm-card-pills">
                      <span className="sm-pill">PDF</span>
                      <span className="sm-pill">{formatFileSize(item.file_size)}</span>
                      <span className="sm-pill">{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                </div>

                {item.description && (
                  <p className="sm-card-desc" style={{ marginTop: "14px" }}>
                    {item.description}
                  </p>
                )}
              </div>

              <div className="sm-card-actions">
                <a
                  href={item.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="sm-action-btn-secondary"
                >
                  <Icon name="eye" /> Open PDF
                </a>
                <a
                  href={item.file_url}
                  download={item.file_name}
                  className="sm-action-btn-primary"
                >
                  <Icon name="download" /> Download
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="sm-table-card">
          <table className="sm-table">
            <thead>
              <tr>
                <th>Resource</th>
                <th>Description</th>
                <th>File Size</th>
                <th>Added Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMaterials.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div className="sm-pdf-icon-wrapper" style={{ width: "36px", height: "36px", fontSize: "18px" }}>
                        <Icon name="filePdf" />
                      </div>
                      <div>
                        <strong style={{ display: "block", fontSize: "14px", color: "var(--text, #111113)" }}>
                          {item.title}
                        </strong>
                        <span style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>{item.file_name}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "var(--text-muted, #64748b)",
                        maxWidth: "320px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.description || <span style={{ opacity: 0.5, fontStyle: "italic" }}>No description</span>}
                    </div>
                  </td>
                  <td>
                    <Badge tone="gray">{formatFileSize(item.file_size)}</Badge>
                  </td>
                  <td style={{ fontSize: "13px", color: "var(--text-muted, #6e6e73)" }}>
                    {formatDate(item.created_at)}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="sm-action-btn-secondary"
                        style={{ height: "32px", padding: "0 12px", fontSize: "12px", flex: "none" }}
                      >
                        <Icon name="eye" /> Open PDF
                      </a>
                      <a
                        href={item.file_url}
                        download={item.file_name}
                        className="sm-action-btn-primary"
                        style={{ height: "32px", padding: "0 12px", fontSize: "12px", flex: "none" }}
                      >
                        <Icon name="download" /> Download
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
