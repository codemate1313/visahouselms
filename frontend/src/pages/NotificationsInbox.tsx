import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import type { StudentNotification } from "@/api/types";
import { Icon } from "@/components/icons";
import { destinationFor, notificationTime, scoreLabel } from "@/utils/notificationHelpers";
import { notificationsInboxStrings as strings } from "./NotificationsInbox.strings";

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
      setError(strings.loadError);
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
    setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, read_at: readAt } : item)));
    try {
      const { data } = await apiClient.patch<StudentNotification>(`/notifications/${notification.id}/read`, undefined, { headers: { "X-Skip-Loader": "1" } });
      setNotifications((items) => items.map((item) => (item.id === notification.id ? data : item)));
    } catch {
      setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, read_at: null } : item)));
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
          <span className="page-eyebrow">{strings.eyebrow}</span>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
        {unread.length > 0 && (
          <button type="button" className="notifications-inbox-mark-all" onClick={() => void markAllRead()}>
            {strings.markAllRead}
          </button>
        )}
      </div>

      <section className="workspace-panel notifications-inbox-panel">
        {loading ? (
          <p className="empty-message">{strings.loadingMessage}</p>
        ) : error ? (
          <div className="empty-state">
            <h2>{strings.errorTitle}</h2>
            <p>{error}</p>
            <button type="button" onClick={() => void loadNotifications()}>
              {strings.retryLabel}
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <h2>{strings.emptyTitle}</h2>
            <p>{strings.emptyDescription}</p>
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
                    {scoreLabel(notification) ? ` ${strings.scorePrefix} ${scoreLabel(notification)}.` : ""}
                  </span>
                  {notification.module_title && <span className="notifications-inbox-item-meta">{notification.module_title}</span>}
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
