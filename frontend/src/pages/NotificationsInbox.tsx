import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import type { StudentNotification } from "@/api/types";
import { Icon } from "@/components/icons";
import { PinList, type PinListItem } from "@/components/PinList";
import { PageHeader } from "@/components/ui";
import { destinationFor, notificationTime, scoreLabel } from "@/utils/notificationHelpers";
import { notificationsInboxStrings as strings } from "./NotificationsInbox.strings";
import "./NotificationsInbox.css";

type PinnableNotification = StudentNotification & PinListItem;

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

  async function togglePin(notification: StudentNotification) {
    const shouldPin = !notification.pinned_at;
    const pinnedAt = shouldPin ? new Date().toISOString() : null;
    const previous = notifications;
    // Optimistic: the pin list animates off this state, so it has to flip now
    // rather than waiting on the round trip.
    setNotifications((items) =>
      items.map((item) => (item.id === notification.id ? { ...item, pinned_at: pinnedAt } : item)),
    );
    try {
      const { data } = await apiClient.patch<StudentNotification>(
        `/notifications/${notification.id}/${shouldPin ? "pin" : "unpin"}`,
        undefined,
        { headers: { "X-Skip-Loader": "1" } },
      );
      setNotifications((items) => items.map((item) => (item.id === notification.id ? data : item)));
    } catch {
      setNotifications(previous);
    }
  }

  function openNotification(notification: StudentNotification) {
    void markRead(notification);
    const destination = destinationFor(notification, fallbackRoute);
    if (destination !== fallbackRoute) navigate(destination);
  }

  // Pinned first (newest pin on top), then the newest-first feed — mirroring
  // the server ordering so the list does not jump after a refetch.
  const pinnableItems = useMemo<PinnableNotification[]>(() => {
    const byRecency = (a: StudentNotification, b: StudentNotification) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return [...notifications]
      .sort((a, b) => {
        if (a.pinned_at && b.pinned_at) return new Date(b.pinned_at).getTime() - new Date(a.pinned_at).getTime();
        if (a.pinned_at) return -1;
        if (b.pinned_at) return 1;
        return byRecency(a, b);
      })
      .map((notification) => ({ ...notification, pinned: Boolean(notification.pinned_at) }));
  }, [notifications]);

  return (
    <div className="notifications-inbox-page">
      <PageHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        subtitle={strings.subtitle}
        actions={unread.length > 0 && (
          <button type="button" className="notifications-inbox-mark-all" onClick={() => void markAllRead()}>
            {strings.markAllRead}
          </button>
        )}
      />

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
          <PinList
            items={pinnableItems}
            onTogglePin={(notification) => void togglePin(notification)}
            labels={{ pinned: strings.pinnedLabel, unpinned: strings.unpinnedLabel }}
            emptyPinnedHint={strings.emptyPinnedHint}
            renderItem={(notification) => (
              <button
                type="button"
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
            )}
          />
        )}
      </section>
    </div>
  );
}
