import type { StudentNotification } from "../api/types";

export function destinationFor(notification: StudentNotification, fallbackRoute: string) {
  if (notification.link_url) return notification.link_url;
  if (notification.kind === "grade_released" && notification.attempt_id) {
    return `/student/attempts/${notification.attempt_id}/result/details`;
  }
  return fallbackRoute;
}

export function notificationTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (Number.isNaN(date.getTime())) return "";
  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hr ago`;
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} d ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function scoreLabel(notification: StudentNotification) {
  if (notification.raw_score == null || notification.max_score == null) return null;
  return `${notification.raw_score} / ${notification.max_score}`;
}
