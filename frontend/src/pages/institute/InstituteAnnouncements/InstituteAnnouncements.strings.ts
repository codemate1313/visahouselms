import type { AudienceCardOption } from "./types";

export const audienceCards: AudienceCardOption[] = [
  { key: "students", title: "Students", icon: "ST", desc: "All institute students" },
  { key: "staff", title: "Staff", icon: "SF", desc: "Instructors and institute staff" },
  { key: "specific_students", title: "Specific Students", icon: "1:1", desc: "Select individual students" },
  { key: "all", title: "Everyone", icon: "ALL", desc: "All institute members" },
];

export const instituteAnnouncementsStrings = {
  eyebrow: "Institute notifications",
  title: "Announcements",
  loadError: "Announcements or student list could not be loaded.",
  scheduleRequiredError: "Please select a date and time for scheduled announcement.",
  studentRequiredError: "Please select at least one target student.",
  saveError: "Announcement could not be saved or published.",
  publisher: {
    title: "New announcement",
    description: "Notify students, staff, or specific individual students with scheduling options.",
    titleLabel: "Title",
    titlePlaceholder: "e.g. Test Schedule Update",
    messageLabel: "Message",
    messagePlaceholder: "Write announcement details...",
    audienceLabel: "Target audience",
    targetHeader: (count: number) => `Select target students (${count} selected)`,
    selectAll: "Select all",
    clearAll: "Clear all",
    searchPlaceholder: "Search students by name or email...",
    noMatchingStudents: "No matching students found in this institute.",
    timingLabel: "Publish timing",
    timingOptions: {
      published: "Send now",
      scheduled: "Schedule",
      draft: "Draft",
    },
    scheduleLabel: "Schedule Date & Time",
    scheduleHint: "Announcement will automatically publish at this date and time.",
    submitLabels: {
      busy: "Processing...",
      scheduled: "Schedule announcement",
      draft: "Save draft",
      published: "Publish announcement",
    },
  },
  history: {
    title: "Announcement history",
    description: "Review published, scheduled, and draft institute announcements.",
    emptyTitle: "No announcements yet",
    emptyDescription: "Published, scheduled, and draft announcements will appear here.",
    audiencePrefix: "Audience",
    scheduledForPrefix: "Scheduled for",
    publishedPrefix: "Published",
  },
};
