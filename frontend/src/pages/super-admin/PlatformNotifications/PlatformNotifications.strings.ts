import type { AudienceCardOption } from "./types";

export const audienceCards: AudienceCardOption[] = [
  { key: "students", title: "Students", iconName: "instructors", desc: "All platform students" },
  { key: "staff", title: "Staff", iconName: "admin", desc: "Instructors & administrators" },
  { key: "institutes", title: "Specific Institutes", iconName: "building", desc: "Select custom institutes" },
  { key: "specific_students", title: "Specific Students", iconName: "user", desc: "Select individual students" },
  { key: "all", title: "Everyone", iconName: "products", desc: "All users on the platform" },
];

export const timingOptions = [
  { key: "published", label: "Send Immediately", icon: "notifications" as const },
  { key: "scheduled", label: "Schedule for Later", icon: "session" as const },
  { key: "draft", label: "Save as Draft", icon: "edit" as const },
];

export const historyStatusTabs = ["ALL", "PUBLISHED", "SCHEDULED", "DRAFT"] as const;

export const platformNotificationsStrings = {
  loadError: "Notifications or targeting options could not be loaded.",
  scheduleRequiredError: "Please select a date and time for scheduled notification.",
  instituteRequiredError: "Please select at least one target institute.",
  studentRequiredError: "Please select at least one target student.",
  saveError: "Notification could not be saved or published.",
  deleteError: "Failed to delete notification.",
  deleteConfirm: (title: string) => `Are you sure you want to delete notification "${title}"? This action cannot be undone.`,
  deleteConfirmTitle: "Delete Notification",
  deleteFallbackTitle: "notification",
  publisher: {
    title: "New Platform Notification",
    subtitle: "Publish a targeted or scheduled announcement with custom audience selection.",
    titleLabel: "Notification Title",
    titlePlaceholder: "e.g. Scheduled System Maintenance",
    messageLabel: "Message Content",
    messagePlaceholder: "Write detailed notification content...",
    audienceLabel: "Target Audience",
    timingLabel: "Publish Timing & Scheduling",
    scheduleLabel: "Schedule Date & Time",
    selectAll: "Select all",
    clearAll: "Clear all",
    instituteTargetHeader: (count: number) => `Select Target Institutes (${count} selected)`,
    instituteSearchPlaceholder: "Filter institutes by name or slug...",
    studentTargetHeader: (count: number) => `Select Target Students (${count} selected)`,
    studentSearchPlaceholder: "Filter students by name or email...",
    submitLabels: {
      busy: "Processing...",
      scheduled: "Schedule Notification",
      draft: "Save Draft",
      published: "Publish Notification",
    },
  },
  history: {
    title: "Notification History",
    subtitle: "Review published, scheduled, and draft platform announcements.",
    searchPlaceholder: "Search title or content...",
    emptyMessage: "No notifications found matching your search or status filter.",
    scheduledPrefix: "Scheduled",
    publishedPrefix: "Published",
    audiencePrefix: "Audience",
    deleteTitle: "Delete Notification",
  },
};
