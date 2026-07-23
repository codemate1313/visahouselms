import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import type { StudentNotification } from "../api/types";
import { Icon } from "../components/icons";
import { destinationFor, notificationTime, scoreLabel } from "../utils/notificationHelpers";

interface NotificationsInboxProps {
  fallbackRoute: string;
}

export function NotificationsInbox({ fallbackRoute }: NotificationsInboxProps) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await apiClient.get<StudentNotification[]>("/notifications", {
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
  }, [loadNotifications]);

  const unread = notifications.filter((notification) => !notification.read_at);

  async function markRead(notification: StudentNotification) {
    if (notification.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => (
      item.id === notification.id ? { ...item, read_at: readAt } : item
    )));
    try {
      const { data } = await apiClient.patch<StudentNotification>(
        `/notifications/${notification.id}/read`,
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
      await apiClient.patch("/notifications/read-all", undefined, { headers: { "X-Skip-Loader": "1" } });
    } catch {
      setNotifications(previous);
    }
  }

  function openNotification(notification: StudentNotification) {
    void markRead(notification);
    const destination = destinationFor(notification, fallbackRoute);
    if (destination !== fallbackRoute) navigate(destination);
  }

  return (
    <div className="notifications-inbox-page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">Updates</span>
          <h1>Notifications</h1>
          <p className="page-subtitle">Everything that needs your attention, in one place.</p>
        </div>
        {unread.length > 0 && (
          <button type="button" className="notifications-inbox-mark-all" onClick={() => void markAllRead()}>
            Mark all as read
          </button>
        )}
      </div>

      <section className="workspace-panel notifications-inbox-panel">
        {loading ? (
          <p className="empty-message">Loading notifications...</p>
        ) : error ? (
          <div className="empty-state">
            <h2>Something went wrong</h2>
            <p>{error}</p>
            <button type="button" onClick={() => void loadNotifications()}>Try again</button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <h2>No notifications</h2>
            <p>You are all caught up.</p>
          </div>
        ) : (
          <div className="notifications-inbox-list">
            {notifications.map((notification) => (
              <button
                type="button"
                key={notification.id}
                className={`notifications-inbox-item${notification.read_at ? " is-read" : " is-unread"}`}
                onClick={() => openNotification(notification)}
              >
                <span className="notifications-inbox-item-icon">
                  <Icon name="notifications" />
                </span>
                <span className="notifications-inbox-item-content">
                  <strong>{notification.title}</strong>
                  <span className="notifications-inbox-item-message">
                    {notification.message}
                    {scoreLabel(notification) ? ` Score ${scoreLabel(notification)}.` : ""}
                  </span>
                  {notification.module_title && (
                    <span className="notifications-inbox-item-meta">{notification.module_title}</span>
                  )}
                </span>
                <span className="notifications-inbox-item-side">
                  {!notification.read_at && <span className="notifications-inbox-dot" aria-hidden="true" />}
                  <time dateTime={notification.created_at}>{notificationTime(notification.created_at)}</time>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
