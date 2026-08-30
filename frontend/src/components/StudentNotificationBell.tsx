import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { apiClient } from "../api/client";
import type { StudentNotification } from "../api/types";
import { destinationFor, notificationTime, scoreLabel } from "../utils/notificationHelpers";

import { Icon } from "./icons";
import { PinList, type PinListItem } from "./PinList";
import { Button } from "./ui/Button/Button";
import { IconButton } from "./ui/IconButton/IconButton";

type PinnableNotification = StudentNotification & PinListItem;

const VISIBLE_COUNT = 8;

interface NotificationBellProps {
  eyebrow?: string;
  fallbackRoute?: string;
  notificationsPath?: string;
  notificationsHref?: string;
  title?: string;
}

/**
 * The tile colour behind each notification.
 *
 * Four of these are semantic and stay fixed, because the colour is the
 * information: red means something failed, amber means marking, green means
 * money, orange means a retake. An admin scanning the list reads those before
 * they read the words.
 *
 * The last two carried no meaning at all - a pink institute tile and an indigo
 * catch-all matched nothing in the product - so they follow the portal's own
 * brand instead. Inside a teal institute portal they are teal; inside super
 * admin they are its red. `--primary` resolves here because the bell copies it
 * onto the portalled drawer (see the `brand` state below).
 */
function getNotificationVisual(notification: StudentNotification) {
  const k = (notification.kind || "").toLowerCase();
  const t = (notification.title || "").toLowerCase();

  if (k.includes("failed") || k.includes("security") || t.includes("failed") || t.includes("error")) {
    return {
      gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
      iconName: "notifications" as const,
      badge: "alert",
    };
  }
  if (k.includes("grade") || k.includes("score") || t.includes("grade") || t.includes("reviewed")) {
    return {
      gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
      iconName: "grading" as const,
      badge: "check",
    };
  }
  if (k.includes("payment") || t.includes("payment") || t.includes("approved")) {
    return {
      gradient: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
      iconName: "restore" as const,
      badge: "check",
    };
  }
  if (k.includes("retake") || t.includes("retake") || t.includes("updated")) {
    return {
      gradient: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
      iconName: "restore" as const,
      badge: "refresh",
    };
  }
  if (k.includes("institute") || t.includes("institute") || t.includes("application")) {
    return {
      gradient: "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)",
      iconName: "building" as const,
      badge: "arrow",
    };
  }
  return {
    gradient: "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)",
    iconName: "notifications" as const,
    badge: "arrow",
  };
}

export function NotificationBell({
  eyebrow = "Updates",
  fallbackRoute = "/",
  notificationsPath = "/notifications",
  notificationsHref,
  title = "Notifications",
}: NotificationBellProps) {
  const navigate = useNavigate();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const isInitialMount = useRef(true);

  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The drawer below is portalled to document.body, so it sits OUTSIDE
  // `.institute-branded-portal` / `.super-admin-portal` and inherits none of
  // their `--primary` remap - which is why it stayed the global red inside a
  // teal institute portal. The bell itself IS inside the wrapper, so we read
  // the resolved colour off it and carry it onto the portalled subtree.
  const [brand, setBrand] = useState<{ primary: string; hover: string } | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await apiClient.get<StudentNotification[]>(notificationsPath, {
        headers: { "X-Skip-Loader": "1" },
      });
      setNotifications(data);
      setError(null);
    } catch {
      setError("Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [notificationsPath]);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  useLayoutEffect(() => {
    if (!isOpen || !shellRef.current) return;
    const styles = getComputedStyle(shellRef.current);
    const primary = styles.getPropertyValue("--primary").trim();
    if (!primary) return;
    const hover = styles.getPropertyValue("--primary-hover").trim();
    setBrand({
      primary,
      // Portals that only define --primary still get a sane pressed state.
      hover: hover || `color-mix(in srgb, ${primary} 82%, #111113)`,
    });
  }, [isOpen]);

  const unread = useMemo(() => notifications.filter((n) => !n.read_at), [notifications]);
  const read = useMemo(() => notifications.filter((n) => Boolean(n.read_at)), [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === "unread") return unread;
    if (filter === "read") return read;
    return notifications;
  }, [filter, notifications, unread, read]);

  const pinnableItems: PinnableNotification[] = useMemo(
    () =>
      filteredNotifications.slice(0, VISIBLE_COUNT).map((notification) => ({
        ...notification,
        pinned: Boolean(notification.pinned_at),
      })),
    [filteredNotifications],
  );

  const togglePanel = () => {
    setIsOpen((prev) => !prev);
  };

  const closePanel = () => {
    setIsOpen(false);
  };

  useLayoutEffect(() => {
    const container = containerRef.current;
    const panel = panelRef.current;
    const backdrop = backdropRef.current;
    if (!container || !panel || !backdrop) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      gsap.set(container, { visibility: "hidden", pointerEvents: "none" });
      gsap.set(backdrop, { opacity: 0 });
      gsap.set(panel, { x: "101%", y: 0, rotation: 0 });
      return;
    }

    if (timelineRef.current) {
      timelineRef.current.kill();
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tl = gsap.timeline();
    timelineRef.current = tl;

    if (isOpen) {
      if (reducedMotion) {
        gsap.set(container, { visibility: "visible", pointerEvents: "auto" });
        gsap.set(backdrop, { opacity: 1 });
        gsap.set(panel, { x: "0%", y: 0, rotation: 0 });
        return;
      }

      tl.set(container, { visibility: "visible", pointerEvents: "auto" })
        .fromTo(
          backdrop,
          { opacity: 0 },
          { opacity: 1, duration: 0.32, ease: "power2.out" },
          0,
        )
        .fromTo(
          panel,
          { x: "101%", y: 0, rotation: 0 },
          { x: "0%", y: 0, rotation: 0, duration: 0.52, ease: "back.out(1.1)" },
          0,
        );

      const items = panel.querySelectorAll(".student-notification-item, .student-notification-state");
      if (items.length > 0) {
        tl.fromTo(
          items,
          { opacity: 0, x: -16 },
          { opacity: 1, x: 0, duration: 0.5, ease: "expo.out", stagger: 0.025 },
          0.08,
        );
      }
    } else {
      if (reducedMotion) {
        gsap.set(container, { visibility: "hidden", pointerEvents: "none" });
        return;
      }

      tl.to(
        panel,
        {
          y: "160vh",
          rotation: "random(-10, 10)",
          duration: 0.46,
          ease: "power3.in",
        },
        0,
      )
      .to(
        backdrop,
        {
          opacity: 0,
          duration: 0.22,
          ease: "power2.in",
        },
        0.04,
      )
      .set(container, { visibility: "hidden", pointerEvents: "none" });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (shellRef.current && shellRef.current.contains(target)) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        closePanel();
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  async function markRead(notification: StudentNotification) {
    if (notification.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => (
      item.id === notification.id ? { ...item, read_at: readAt } : item
    )));
    try {
      const { data } = await apiClient.patch<StudentNotification>(
        `${notificationsPath}/${notification.id}/read`,
        undefined,
        { headers: { "X-Skip-Loader": "1" } },
      );
      setNotifications((items) => items.map((item) => item.id === notification.id ? data : item));
    } catch {
      setNotifications((items) => items.map((item) => (
        item.id === notification.id ? { ...item, read_at: null } : item
      )));
    }
  }

  async function markAllRead() {
    const previous = notifications;
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at ?? readAt })));
    try {
      await apiClient.patch(
        `${notificationsPath}/read-all`,
        undefined,
        { headers: { "X-Skip-Loader": "1" } },
      );
    } catch {
      setNotifications(previous);
    }
  }

  async function togglePin(notification: StudentNotification) {
    const shouldPin = !notification.pinned_at;
    const pinnedAt = shouldPin ? new Date().toISOString() : null;
    const previous = notifications;
    setNotifications((items) =>
      items.map((item) => (item.id === notification.id ? { ...item, pinned_at: pinnedAt } : item)),
    );
    try {
      const { data } = await apiClient.patch<StudentNotification>(
        `${notificationsPath}/${notification.id}/${shouldPin ? "pin" : "unpin"}`,
        undefined,
        { headers: { "X-Skip-Loader": "1" } },
      );
      setNotifications((items) => items.map((item) => item.id === notification.id ? data : item));
    } catch {
      setNotifications(previous);
    }
  }

  function openNotification(notification: StudentNotification) {
    void markRead(notification);
    setIsOpen(false);
    navigate(destinationFor(notification, notificationsHref ?? fallbackRoute));
  }

  return (
    <div className="student-notification-shell" ref={shellRef}>
      <IconButton
        className={`student-notification-bell${unread.length ? " has-unread" : ""}`}
        onClick={togglePanel}
        label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        icon={
          <>
            <Icon name="notifications" />
            {unread.length > 0 && (
              <span className="student-notification-count" aria-hidden="true">
                {unread.length > 99 ? "99+" : unread.length}
              </span>
            )}
          </>
        }
      />

      {typeof document !== "undefined" && createPortal(
        <div
          ref={containerRef}
          className="student-notification-drawer-wrapper"
          style={{
            visibility: "hidden",
            pointerEvents: "none",
            ...(brand
              ? ({
                  "--primary": brand.primary,
                  "--primary-hover": brand.hover,
                  "--primary-soft": `color-mix(in srgb, ${brand.primary} 14%, transparent)`,
                } as CSSProperties)
              : {}),
          }}
        >
          <div
            ref={backdropRef}
            className="student-notification-drawer-backdrop"
            onClick={closePanel}
            aria-hidden="true"
          />
          <div
            ref={panelRef}
            className="student-notification-drawer-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="portal-notification-title"
          >
            <div className="student-notification-header">
              <div className="student-notification-header-title-group">
                <h2 id="portal-notification-title">{title}</h2>
                {unread.length > 0 && (
                  <span className="student-notification-unread-pill">{unread.length} new</span>
                )}
              </div>
              <div className="student-notification-header-actions">
                {unread.length > 0 && (
                  <Button
                    type="button"
                    variant="text"
                    className="student-notification-read-all"
                    onClick={() => void markAllRead()}
                    title="Mark all notifications as read"
                    leftIcon={
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    }
                  >
                    Mark all as read
                  </Button>
                )}
                <IconButton
                  className="student-notification-close-btn"
                  onClick={closePanel}
                  label="Close notifications"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  }
                />
              </div>
            </div>

            <div className="student-notification-filter-bar">
              <div className="student-notification-segmented-track" role="tablist" aria-label="Notification filters">
                <div
                  className="student-notification-tab-indicator"
                  style={{ transform: `translateX(${filter === "unread" ? 100 : filter === "read" ? 200 : 0}%)` }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "all"}
                  className={`student-notification-filter-tab${filter === "all" ? " is-active" : ""}`}
                  onClick={() => setFilter("all")}
                >
                  <span className="student-notification-tab-label">All</span>
                  <span className="student-notification-tab-badge">{notifications.length}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "unread"}
                  className={`student-notification-filter-tab${filter === "unread" ? " is-active" : ""}`}
                  onClick={() => setFilter("unread")}
                >
                  <span className="student-notification-tab-label">Unread</span>
                  <span className={`student-notification-tab-badge${unread.length > 0 ? " has-unread" : ""}`}>
                    {unread.length}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={filter === "read"}
                  className={`student-notification-filter-tab${filter === "read" ? " is-active" : ""}`}
                  onClick={() => setFilter("read")}
                >
                  <span className="student-notification-tab-label">Read</span>
                  <span className="student-notification-tab-badge">{read.length}</span>
                </button>
              </div>
            </div>

            <div className="student-notification-list">
              {loading ? (
                <p className="student-notification-state">Loading notifications...</p>
              ) : error ? (
                <div className="student-notification-state is-error">
                  <p>{error}</p>
                  <Button type="button" onClick={() => void loadNotifications()}>Try again</Button>
                </div>
              ) : pinnableItems.length === 0 ? (
                <div className="student-notification-state">
                  <strong>No notifications</strong>
                  <p>{eyebrow}. You are all caught up.</p>
                </div>
              ) : (
                <PinList
                  key={filter}
                  items={pinnableItems}
                  onTogglePin={(notification) => void togglePin(notification)}
                  renderItem={(notification) => {
                    const visual = getNotificationVisual(notification);
                    const isUnread = !notification.read_at;
                    const score = scoreLabel(notification);

                    return (
                      <button
                        type="button"
                        className={`student-notification-item${isUnread ? " is-unread" : " is-read"}${notification.pinned ? " is-pinned" : ""}`}
                        onClick={() => openNotification(notification)}
                      >
                        <div className="student-notification-avatar-wrap">
                          {isUnread && <span className="student-notification-unread-dot" aria-hidden="true" />}
                          <div className="student-notification-icon-squircle" style={{ background: visual.gradient }}>
                            <Icon name={visual.iconName} className="student-notification-tile-icon" />
                          </div>
                          <div className={`student-notification-mini-badge is-${visual.badge}`}>
                            {visual.badge === "check" ? (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : visual.badge === "refresh" ? (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                              </svg>
                            ) : visual.badge === "alert" ? (
                              <span style={{ fontSize: "8.5px", fontWeight: 800 }}>!</span>
                            ) : (
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                              </svg>
                            )}
                          </div>
                        </div>

                        <div className="student-notification-item-content">
                          <div className="student-notification-headline">
                            <strong className="student-notification-title-highlight">“{notification.title}”</strong>
                            <span className="student-notification-message-body">{notification.message}</span>
                          </div>

                          {score && (
                            <div className="student-notification-score-chip">
                              <span>Result</span>
                              <span className="student-notification-score-diamond">◆</span>
                              <strong>{score}</strong>
                            </div>
                          )}

                          <time className="student-notification-time" dateTime={notification.created_at}>
                            {notificationTime(notification.created_at)}
                          </time>
                        </div>
                      </button>
                    );
                  }}
                />
              )}
            </div>

            <div className="student-notification-drawer-footer">
              <Button
                type="button"
                variant="text"
                className="student-notification-view-all"
                onClick={() => {
                  closePanel();
                  navigate(notificationsHref ?? fallbackRoute);
                }}
              >
                View All Notifications
              </Button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
