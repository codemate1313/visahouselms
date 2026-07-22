import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { apiClient } from "../api/client";
import type { StudentNotification } from "../api/types";
import { Icon } from "./icons";

type NotificationSegment = "unread" | "read";

function destinationFor(notification: StudentNotification) {
  if (notification.kind === "grade_released" && notification.attempt_id) {
    return `/student/attempts/${notification.attempt_id}/result/details`;
  }
  return "/student/dashboard";
}

function notificationTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function scoreLabel(notification: StudentNotification) {
  if (notification.raw_score == null || notification.max_score == null) return null;
  return `${notification.raw_score} / ${notification.max_score}`;
}

export function StudentNotificationBell() {
  const navigate = useNavigate();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [segment, setSegment] = useState<NotificationSegment>("unread");
  const [panelVisible, setPanelVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await apiClient.get<StudentNotification[]>("/student/notifications", {
        headers: { "X-Skip-Loader": "1" },
      });
      setNotifications(data);
      setError(null);
    } catch {
      setError("Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 30_000);
    const refreshOnFocus = () => void loadNotifications();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadNotifications]);

  useLayoutEffect(() => {
    if (!panelVisible || !panelRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.fromTo(
      panelRef.current,
      { autoAlpha: 0, y: -8, scale: reducedMotion ? 1 : 0.96, transformOrigin: "top right" },
      { autoAlpha: 1, y: 0, scale: 1, duration: reducedMotion ? 0 : 0.32, ease: "back.out(1.35)" },
    );
  }, [panelVisible]);

  const closePanel = useCallback(() => {
    const panel = panelRef.current;
    if (!panelVisible || !panel) {
      setPanelVisible(false);
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.killTweensOf(panel);
    gsap.to(panel, {
      autoAlpha: 0,
      y: -6,
      scale: reducedMotion ? 1 : 0.98,
      duration: reducedMotion ? 0 : 0.16,
      ease: "power2.in",
      onComplete: () => setPanelVisible(false),
    });
  }, [panelVisible]);

  useEffect(() => {
    if (!panelVisible) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) closePanel();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closePanel, panelVisible]);

  const unread = notifications.filter((notification) => !notification.read_at);
  const read = notifications.filter((notification) => notification.read_at);
  const visibleNotifications = segment === "unread" ? unread : read;

  async function markRead(notification: StudentNotification) {
    if (notification.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => (
      item.id === notification.id ? { ...item, read_at: readAt } : item
    )));
    try {
      const { data } = await apiClient.patch<StudentNotification>(
        `/student/notifications/${notification.id}/read`,
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
        "/student/notifications/read-all",
        undefined,
        { headers: { "X-Skip-Loader": "1" } },
      );
    } catch {
      setNotifications(previous);
    }
  }

  function openNotification(notification: StudentNotification) {
    void markRead(notification);
    closePanel();
    navigate(destinationFor(notification));
  }

  return (
    <div className="student-notification-shell" ref={shellRef}>
      <button
        type="button"
        className={`student-notification-bell${unread.length ? " has-unread" : ""}`}
        onClick={() => {
          if (panelVisible) {
            closePanel();
          } else {
            setSegment("unread");
            setPanelVisible(true);
          }
        }}
        aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={panelVisible}
      >
        <Icon name="notifications" />
        {unread.length > 0 && (
          <span className="student-notification-count" aria-hidden="true">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>

      {panelVisible && (
        <div
          ref={panelRef}
          className="student-notification-popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby="student-notification-title"
        >
          <div className="student-notification-header">
            <div>
              <span className="page-eyebrow">Student updates</span>
              <h2 id="student-notification-title">Notifications</h2>
            </div>
            <button type="button" className="student-notification-close" onClick={closePanel} aria-label="Close notifications">
              &times;
            </button>
          </div>

          <div className="student-notification-segments" role="tablist" aria-label="Notification status">
            <button
              type="button"
              role="tab"
              aria-selected={segment === "unread"}
              className={segment === "unread" ? "is-active" : ""}
              onClick={() => setSegment("unread")}
            >
              Unread <span>{unread.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={segment === "read"}
              className={segment === "read" ? "is-active" : ""}
              onClick={() => setSegment("read")}
            >
              Read <span>{read.length}</span>
            </button>
          </div>

          <div className="student-notification-list" role="tabpanel">
            {segment === "unread" && unread.length > 0 && (
              <button type="button" className="student-notification-read-all" onClick={() => void markAllRead()}>
                Mark all as read
              </button>
            )}

            {loading ? (
              <p className="student-notification-state">Loading notifications...</p>
            ) : error ? (
              <div className="student-notification-state is-error">
                <p>{error}</p>
                <button type="button" onClick={() => void loadNotifications()}>Try again</button>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <div className="student-notification-state">
                <strong>No {segment} notifications</strong>
                <p>{segment === "unread" ? "You are all caught up." : "Notifications you open will appear here."}</p>
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  type="button"
                  className={`student-notification-item${notification.read_at ? " is-read" : " is-unread"}`}
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                >
                  <span className="student-notification-item-dot" />
                  <span className="student-notification-item-content">
                    <strong>{notification.title}</strong>
                    <span className="student-notification-message">{notification.message}</span>
                    <span className="student-notification-meta">
                      {notification.module_type && <span>{notification.module_type.replaceAll("_", " ")}</span>}
                      {scoreLabel(notification) && <span>Score {scoreLabel(notification)}</span>}
                      <time dateTime={notification.created_at}>{notificationTime(notification.created_at)}</time>
                    </span>
                  </span>
                  <span className="student-notification-item-arrow" aria-hidden="true">&#8250;</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
