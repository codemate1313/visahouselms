import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/client";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/Button/Button";
import { IconButton } from "@/components/ui/IconButton/IconButton";

gsap.registerPlugin(ScrollTrigger);

interface InstagramItem {
  id: string;
  media_type: string;
  media_url: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  views_count?: number;
  timestamp?: string;
}

interface InstagramFeedResponse {
  is_enabled: boolean;
  username: string;
  items: InstagramItem[];
}

function getInstagramEmbedUrl(permalink?: string, mediaUrl?: string): string | null {
  const target = permalink || mediaUrl || "";
  const match = target.match(/(?:instagram\.com\/(?:reel|reels|p|tv)\/)([A-Za-z0-9_-]+)/i);
  if (match && match[1]) {
    const isReel = /(?:reel|reels)/i.test(target);
    const typePath = isReel ? "reel" : "p";
    return `https://www.instagram.com/${typePath}/${match[1]}/embed/`;
  }
  return null;
}

export function InstagramFeedSection() {
  const [feed, setFeed] = useState<InstagramFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<InstagramItem | null>(null);
  const [playMode, setPlayMode] = useState(true);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/instagram/feed`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: InstagramFeedResponse | null) => {
        if (data && data.is_enabled && Array.isArray(data.items) && data.items.length > 0) {
          setFeed(data);
        } else {
          setFeed(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setFeed(null);
        setLoading(false);
      });
  }, []);

  // Highly Polished GSAP ScrollTrigger Entrance Choreography for Header + Profile + Grid
  useEffect(() => {
    if (!feed || !feed.items.length || !sectionRef.current) return;

    const section = sectionRef.current;
    const ctx = gsap.context(() => {
      const eyebrowEl = section.querySelector(".vh-instagram-eyebrow");
      const titleEl = section.querySelector(".vh-instagram-title-centered");
      const subtitleEl = section.querySelector(".vh-instagram-subtitle-centered");
      
      const profileCardEl = section.querySelector(".vh-instagram-profile-card");
      const gridEl = section.querySelector(".vh-instagram-grid");
      const leftCards = gsap.utils.toArray<HTMLElement>(".vh-instagram-card-left", section);
      const rightCards = gsap.utils.toArray<HTMLElement>(".vh-instagram-card-right", section);

      // Section Header & Profile Master Timeline
      const headerTl = gsap.timeline({
        scrollTrigger: {
          trigger: eyebrowEl || section,
          start: "top 88%",
          toggleActions: "play none none reverse",
        },
      });

      // 1. Eyebrow reveals with GPU upward glide
      if (eyebrowEl) {
        headerTl.fromTo(
          eyebrowEl,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.65, ease: "power2.out", clearProps: "transform,opacity" },
          0
        );
      }

      // 2. Headline reveals with scale & upward glide
      if (titleEl) {
        headerTl.fromTo(
          titleEl,
          { opacity: 0, y: 24, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: "power3.out", clearProps: "transform,opacity,scale" },
          0.04
        );
      }

      // 3. Subtitle smooth fade up (along with title)
      if (subtitleEl) {
        headerTl.fromTo(
          subtitleEl,
          { opacity: 0, y: 24, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: "power3.out", clearProps: "transform,opacity,scale" },
          0.04
        );
      }

      // 4. Entire Profile Bar Widget smoothly glides up simultaneously along with Join our Instagram Community
      if (profileCardEl) {
        headerTl.fromTo(
          profileCardEl,
          { opacity: 0, y: 24, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: "power3.out", clearProps: "transform,opacity,scale" },
          0.04
        );
      }

      // 3D Cinematic Grid Fly-in from Left & Right for Reels Cards
      const gridTl = gsap.timeline({
        scrollTrigger: {
          trigger: gridEl || section,
          start: "top 84%",
          toggleActions: "play none none reverse",
        },
      });

      if (leftCards.length) {
        gridTl.fromTo(
          leftCards,
          {
            opacity: 0,
            x: -95,
            y: 75,
            rotateY: 12,
            rotateZ: -3.5,
            scale: 0.91,
            filter: "blur(6px)",
          },
          {
            opacity: 1,
            x: 0,
            y: 0,
            rotateY: 0,
            rotateZ: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 1.25,
            stagger: 0.14,
            ease: "power4.out",
          },
          0
        );
      }

      if (rightCards.length) {
        gridTl.fromTo(
          rightCards,
          {
            opacity: 0,
            x: 95,
            y: 75,
            rotateY: -12,
            rotateZ: 3.5,
            scale: 0.91,
            filter: "blur(6px)",
          },
          {
            opacity: 1,
            x: 0,
            y: 0,
            rotateY: 0,
            rotateZ: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 1.25,
            stagger: 0.14,
            ease: "power4.out",
          },
          0.06
        );
      }
    }, section);

    return () => ctx.revert();
  }, [feed]);

  if (loading || !feed || !feed.is_enabled || feed.items.length === 0) {
    return null;
  }

  const username = feed.username || "visa_house_imm";
  const profileUrl = `https://www.instagram.com/${username}/`;

  return (
    <section className="vh-instagram-section" id="instagram-feed" ref={sectionRef}>
      {/* Sleek Instagram Ambient Glow Orbs */}
      <div className="vh-instagram-aura vh-instagram-aura-top-left" aria-hidden="true" />
      <div className="vh-instagram-aura vh-instagram-aura-top-right" aria-hidden="true" />
      <div className="vh-instagram-aura vh-instagram-aura-center" aria-hidden="true" />

      <div className="vh-instagram-container">
        {/* Centered Premium Section Header */}
        <div className="vh-instagram-header-centered">
          <span className="vh-instagram-eyebrow">Latest Reels &amp; Insights</span>
          <h2 className="vh-instagram-title-centered">
            Join our <span className="vh-accent">Instagram</span> Community
          </h2>
          <p className="vh-instagram-subtitle-centered">
            Daily test tips, examiner speaking breakdowns, and student success stories straight from our trainers.
          </p>

          {/* Luxury Instagram Profile Bar Widget */}
          <div className="vh-instagram-profile-card">
            <div className="vh-instagram-profile-identity">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="vh-instagram-avatar-ring"
                title="View Instagram Profile"
              >
                <div className="vh-instagram-avatar-inner">
                  <img
                    src="/brand/visa-house-round-logo.png"
                    alt="Visa House Logo"
                    className="vh-instagram-avatar-logo"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        const span = document.createElement("span");
                        span.className = "vh-instagram-avatar-initials";
                        span.innerText = "VH";
                        parent.appendChild(span);
                      }
                    }}
                  />
                </div>
              </a>
              <div className="vh-instagram-profile-text">
                <div className="vh-instagram-profile-name">
                  <span>Visa House Immigrations</span>
                  <svg className="vh-instagram-verified-badge" width="16" height="16" viewBox="0 0 24 24" fill="#0095f6">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vh-instagram-profile-handle"
                >
                  @{username}
                </a>
              </div>
            </div>

            <div className="vh-instagram-profile-stats">
              <div className="vh-instagram-stat-item">
                <strong className="vh-instagram-stat-num">450+</strong>
                <span className="vh-instagram-stat-label">Posts</span>
              </div>
              <div className="vh-instagram-stat-item">
                <strong className="vh-instagram-stat-num">14.4k</strong>
                <span className="vh-instagram-stat-label">Followers</span>
              </div>
              <div className="vh-instagram-stat-item">
                <strong className="vh-instagram-stat-num">19</strong>
                <span className="vh-instagram-stat-label">Following</span>
              </div>
            </div>

            <div className="vh-instagram-profile-action">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="vh-instagram-profile-follow-btn"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
                <span>Follow</span>
              </a>
            </div>
          </div>
        </div>

        {/* Reels & Posts Grid with Alternating Up/Down Stagger */}
        <div className="vh-instagram-grid vh-instagram-grid-staggered">
          {feed.items.map((item, idx) => {
            const isReel = item.media_type === "REEL" || item.media_type === "VIDEO";
            const imageSrc = item.thumbnail_url || item.media_url;

            // In 4-column layout:
            // Columns 0 & 2 are UP (baseline), Columns 1 & 3 are DOWN (offset)
            const colPos = idx % 4;
            const isDown = colPos === 1 || colPos === 3;
            const staggerClass = isDown ? "vh-instagram-card-down" : "vh-instagram-card-up";

            // Left vs Right animation trigger:
            // Columns 0 & 1 fly from left; Columns 2 & 3 fly from right
            const isLeft = colPos === 0 || colPos === 1;
            const animDirClass = isLeft ? "vh-instagram-card-left" : "vh-instagram-card-right";

            return (
              <div
                key={item.id}
                className={`vh-instagram-card ${staggerClass} ${animDirClass}`}
                onClick={() => {
                  setSelectedItem(item);
                  setPlayMode(true);
                }}
              >
                <div className="vh-instagram-media-wrap">
                  {/* Subtle luxury light sweep on hover */}
                  <div className="vh-instagram-card-sheen" />

                  <img
                    src={imageSrc}
                    alt={item.caption || "Instagram Reel"}
                    loading="lazy"
                    className="vh-instagram-media-img"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80";
                    }}
                  />

                  {/* Badge: Reel vs Post */}
                  <div className="vh-instagram-type-badge">
                    {isReel ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span>Reel</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                        <span>Post</span>
                      </>
                    )}
                  </div>

                  {/* Play icon overlay on hover */}
                  {isReel && (
                    <div className="vh-instagram-play-overlay">
                      <div className="vh-instagram-play-circle">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                          <polygon points="6 4 20 12 6 20 6 4" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Gradient bottom overlay with engagement counters & caption */}
                  <div className="vh-instagram-overlay-bottom">
                    <div className="vh-instagram-stats-row">
                      <span className="vh-instagram-stat">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        {item.like_count ? item.like_count.toLocaleString() : "1.2k"}
                      </span>

                      {isReel && item.views_count ? (
                        <span className="vh-instagram-stat">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          {item.views_count.toLocaleString()}
                        </span>
                      ) : (
                        <span className="vh-instagram-stat">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          {item.comments_count ? item.comments_count.toLocaleString() : "45"}
                        </span>
                      )}
                    </div>

                    {item.caption && (
                      <p className="vh-instagram-caption-snippet">{item.caption}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Preview on Item Click */}
      {selectedItem && (() => {
        const isReel = selectedItem.media_type === "REEL" || selectedItem.permalink.includes("/reel/");
        const isDirectVideo = Boolean(selectedItem.media_url && selectedItem.media_url.endsWith(".mp4"));
        const embedUrl = getInstagramEmbedUrl(selectedItem.permalink, selectedItem.media_url);

        return (
          <div className="vh-instagram-modal-backdrop" onClick={() => setSelectedItem(null)}>
            <div className="vh-instagram-modal-card" onClick={(e) => e.stopPropagation()}>
              <IconButton
                className="vh-instagram-modal-close"
                onClick={() => setSelectedItem(null)}
                label="Close"
                icon="✕"
              />

              <div className="vh-instagram-modal-media">
                {playMode && isDirectVideo ? (
                  <video
                    src={selectedItem.media_url}
                    poster={selectedItem.thumbnail_url}
                    controls
                    autoPlay
                    playsInline
                    className="vh-instagram-modal-video"
                  />
                ) : playMode && embedUrl ? (
                  <div className="vh-instagram-iframe-container">
                    <iframe
                      src={embedUrl}
                      title={selectedItem.caption || "Instagram Reel"}
                      className="vh-instagram-modal-iframe"
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      allowFullScreen
                      frameBorder="0"
                      scrolling="no"
                    />
                  </div>
                ) : (
                  <div className="vh-instagram-modal-cover-wrap">
                    <img
                      src={selectedItem.thumbnail_url || selectedItem.media_url}
                      alt="Instagram Preview"
                      className="vh-instagram-modal-cover-img"
                    />
                    {(isReel || embedUrl || isDirectVideo) && (
                      <Button
                        type="button"
                        className="vh-instagram-modal-play-btn"
                        onClick={() => setPlayMode(true)}
                        title="Play Reel Video"
                        leftIcon={
                          <div className="vh-instagram-play-circle-lg">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                              <polygon points="6 4 20 12 6 20 6 4" />
                            </svg>
                          </div>
                        }
                      >
                        Play Video
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="vh-instagram-modal-info">
                <div className="vh-instagram-modal-author">
                  <div className="vh-instagram-author-avatar-img-wrap">
                    <img
                      src="/brand/visa-house-round-logo.png"
                      alt="Visa House Logo"
                      className="vh-instagram-modal-logo"
                    />
                  </div>
                  <div>
                    <div className="vh-instagram-author-handle">@{username}</div>
                    <div className="vh-instagram-author-sub">Visa House Immigrations</div>
                  </div>
                </div>

                <div className="vh-instagram-modal-body">
                  <p>{selectedItem.caption || "LanguageCert exam preparation & study tips."}</p>
                </div>

                <div className="vh-instagram-modal-stats">
                  <span>♥ {selectedItem.like_count ? selectedItem.like_count.toLocaleString() : 0} likes</span>
                  {selectedItem.views_count ? (
                    <span>👁 {selectedItem.views_count.toLocaleString()} views</span>
                  ) : null}
                </div>

                <a
                  href={selectedItem.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vh-instagram-modal-link-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: "middle", marginRight: 8 }}>
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Watch Reel on Instagram ↗
                </a>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
