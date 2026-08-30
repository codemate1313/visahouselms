import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import type { StudentNotification } from "@/api/types";
import { Icon } from "@/components/icons";
import { PinList, type PinListItem } from "@/components/PinList";
import { PageHeader, SearchableSelect, SegmentedControl } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { cleanNotificationMessage, destinationFor, notificationTime, scoreLabel } from "@/utils/notificationHelpers";
import { notificationsInboxStrings as strings } from "./NotificationsInbox.strings";
import "./NotificationsInbox.css";

type PinnableNotification = StudentNotification & PinListItem;

interface NotificationsInboxProps {
  fallbackRoute: string;
}

type TimeFilter = "all" | "today" | "7days" | "30days";

function matchesTimeFilter(createdAt: string, timeFilter: TimeFilter): boolean {
  if (timeFilter === "all") return true;
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (timeFilter === "today") {
    return created.toDateString() === now.toDateString();
  }
  if (timeFilter === "7days") {
    return diffDays <= 7;
  }
  if (timeFilter === "30days") {
    return diffDays <= 30;
  }
  return true;
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

  const [filterTab, setFilterTab] = useState<"all" | "unread" | "read">("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");

  const unread = notifications.filter((notification) => !notification.read_at);
  const read = notifications.filter((notification) => Boolean(notification.read_at));

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (filterTab === "unread" && n.read_at) return false;
      if (filterTab === "read" && !n.read_at) return false;
      if (!matchesTimeFilter(n.created_at, timeFilter)) return false;
      return true;
    });
  }, [notifications, filterTab, timeFilter]);

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
    return [...filteredNotifications]
      .sort((a, b) => {
        if (a.pinned_at && b.pinned_at) return new Date(b.pinned_at).getTime() - new Date(a.pinned_at).getTime();
        if (a.pinned_at) return -1;
        if (b.pinned_at) return 1;
        return byRecency(a, b);
      })
      .map((notification) => ({ ...notification, pinned: Boolean(notification.pinned_at) }));
  }, [filteredNotifications]);

  return (
    <div className="notifications-inbox-page">
      <PageHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        subtitle={strings.subtitle}
        actions={unread.length > 0 && (
          <Button type="button" variant="text" className="notifications-inbox-mark-all" onClick={() => void markAllRead()}>
            {strings.markAllRead}
          </Button>
        )}
      />

      <section className="workspace-panel notifications-inbox-panel">
        {!loading && !error && notifications.length > 0 && (
          <div className="notifications-inbox-filter-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "18px", padding: "10px 16px", background: "var(--surface-muted, #f8fafc)", borderRadius: "14px", border: "1px solid var(--border)" }}>
            <SegmentedControl<"all" | "unread" | "read">
              ariaLabel="Notification status filter"
              onChange={setFilterTab}
              value={filterTab}
              options={[
                {
                  label: (
                    <span className="segmented-tab-label">
                      <span>All</span>
                      <span className="segmented-tab-count">{notifications.length}</span>
                    </span>
                  ),
                  value: "all",
                },
                {
                  label: (
                    <span className="segmented-tab-label">
                      <span>Unread</span>
                      <span className="segmented-tab-count">{unread.length}</span>
                    </span>
                  ),
                  value: "unread",
                },
                {
                  label: (
                    <span className="segmented-tab-label">
                      <span>Read</span>
                      <span className="segmented-tab-count">{read.length}</span>
                    </span>
                  ),
                  value: "read",
                },
              ]}
            />

            <div className="notifications-time-filter" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>
                Time Range:
              </span>
              <div style={{ width: "160px", flexShrink: 0 }}>
                <SearchableSelect
                  options={[
                    { value: "all", label: "All Time" },
                    { value: "today", label: "Today" },
                    { value: "7days", label: "Last 7 Days" },
                    { value: "30days", label: "Last 30 Days" },
                  ]}
                  value={timeFilter}
                  onChange={(val) => setTimeFilter(val as TimeFilter)}
                  searchable={false}
                  align="end"
                  placeholder="Time Range"
                />
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="empty-message">{strings.loadingMessage}</p>
        ) : error ? (
          <div className="empty-state">
            <h2>{strings.errorTitle}</h2>
            <p>{error}</p>
            <Button type="button" onClick={() => void loadNotifications()}>
              {strings.retryLabel}
            </Button>
          </div>
        ) : pinnableItems.length === 0 ? (
          <div className="empty-state">
            <h2>
              {timeFilter !== "all"
                ? "No notifications found"
                : filterTab === "unread"
                ? "No unread notifications"
                : filterTab === "read"
                ? "No read notifications"
                : strings.emptyTitle}
            </h2>
            <p>
              {timeFilter !== "all"
                ? `No notifications found for ${timeFilter === "today" ? "Today" : timeFilter === "7days" ? "the Last 7 Days" : "the Last 30 Days"}.`
                : filterTab === "unread"
                ? "You have read all your notifications."
                : filterTab === "read"
                ? "You have no read notifications yet."
                : strings.emptyDescription}
            </p>
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
                className={`notifications-inbox-item notification-card${notification.read_at ? " is-read" : " is-unread"}`}
                onClick={() => openNotification(notification)}
              >
                <span className="notification-card-icon">
                  <span className="notifications-inbox-item-icon">
                    <Icon name="notifications" />
                  </span>
                </span>
                <span className="notification-card-body">
                  <span className="notification-card-title-row">
                    <span className="visually-hidden">{notification.read_at ? "Read: " : "Unread: "}</span>
                    <strong>{notification.title}</strong>
                  </span>
                  <span className="notification-card-message">
                    {cleanNotificationMessage(notification) && (
                      <span className="notifications-inbox-item-message">
                        {cleanNotificationMessage(notification)}
                        {scoreLabel(notification) ? ` ${strings.scorePrefix} ${scoreLabel(notification)}.` : ""}
                      </span>
                    )}
                    {notification.module_title && <span className="notifications-inbox-item-meta">{notification.module_title}</span>}
                  </span>
                </span>
                <span className="notification-card-meta notifications-inbox-item-side">
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
