import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { apiClient } from "../api/client";
import type { StudentNotification } from "../api/types";
import { notificationTime, scoreLabel } from "../utils/notificationHelpers";
import { Icon } from "./icons";

interface NotificationBellProps {
  eyebrow?: string;
  fallbackRoute?: string;
  notificationsPath?: string;
  notificationsHref?: string;
  title?: string;
}

const HOVER_CLOSE_DELAY = 220;

export function NotificationBell({
  eyebrow = "Updates",
  fallbackRoute = "/",
  notificationsPath = "/notifications",
  notificationsHref,
  title = "Notifications",
}: NotificationBellProps) {
  const navigate = useNavigate();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [panelVisible, setPanelVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      { autoAlpha: 0, y: reducedMotion ? 0 : -16, scale: reducedMotion ? 1 : 0.86, transformOrigin: "top right" },
      { autoAlpha: 1, y: 0, scale: 1, duration: reducedMotion ? 0 : 0.6, ease: "elastic.out(1, 0.65)" },
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

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openPanel = useCallback(() => {
    cancelScheduledClose();
    setPanelVisible(true);
  }, [cancelScheduledClose]);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      closePanel();
    }, HOVER_CLOSE_DELAY);
  }, [cancelScheduledClose, closePanel]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  const unread = notifications.filter((notification) => !notification.read_at);
  const visibleNotifications = notifications.slice(0, 6);

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

  function openNotification(notification: StudentNotification) {
    void markRead(notification);
    closePanel();
    navigate(notificationsHref ?? fallbackRoute);
  }

  return (
    <div
      className="student-notification-shell"
      ref={shellRef}
      onMouseEnter={openPanel}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className={`student-notification-bell${unread.length ? " has-unread" : ""}`}
        onClick={() => (panelVisible ? closePanel() : openPanel())}
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
          aria-labelledby="portal-notification-title"
        >
          <div className="student-notification-header">
            <h2 id="portal-notification-title">{title}</h2>
          </div>

          <div className="student-notification-list">
            {unread.length > 0 && (
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
                <strong>No notifications</strong>
                <p>{eyebrow}. You are all caught up.</p>
              </div>
            ) : (
              visibleNotifications.map((notification) => (
                <button
                  type="button"
                  className={`student-notification-item${notification.read_at ? " is-read" : " is-unread"}`}
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                >
                  <span className="student-notification-item-icon">
                    <Icon name="notifications" />
                  </span>
                  <span className="student-notification-item-content">
                    <strong>{notification.title}</strong>
                    <span className="student-notification-message">
                      {notification.message}
                      {scoreLabel(notification) ? ` Score ${scoreLabel(notification)}.` : ""}
                    </span>
                  </span>
                  <time className="student-notification-time" dateTime={notification.created_at}>
                    {notificationTime(notification.created_at)}
                  </time>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="student-notification-view-all"
            onClick={() => {
              closePanel();
              navigate(notificationsHref ?? fallbackRoute);
            }}
          >
            View All Notifications
          </button>
        </div>
      )}
    </div>
  );
}
