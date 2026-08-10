import type { ExamModuleType } from "@/api/types";

export const modulesStrings = {
  title: "Courses",
  subtitle: "Choose the assessment type, then build its questions and media inside the generated parts.",
  createAriaLabel: "Create an assessment module",
  createCta: "Create",
  yourCourses: {
    title: "Your courses",
    description: "Draft, validate, publish, and update each assessment course.",
  },
  searchPlaceholder: "Search courses...",
  searchAriaLabel: "Search courses",
  typeFilter: {
    ariaLabel: "Module type",
    all: "All types",
  },
  statusFilter: {
    ariaLabel: "Module status",
    all: "All statuses",
    draft: "Draft",
    published: "Published",
    archived: "Archived",
  },
  search: "Search",
  loading: "Loading...",
  errors: {
    load: "Failed to load assessment modules.",
    delete: "Failed to delete draft course.",
  },
  empty: {
    title: "No modules found",
    description: "Choose one of the six module types above to begin.",
  },
  deleteDraft: "Delete draft",
  deleteDraftShort: "Delete",
  continueSetup: "Continue setup",
  reviewAndPublish: "Review & publish",
  confirmDelete: {
    message: (title: string) => `Are you sure you want to delete draft "${title}"?`,
    title: "Delete Draft Course",
  },
  readyToPublish: "Ready to publish",
  editModule: "Edit",
  requirementsRemaining: (count: number) => `${count} requirement${count === 1 ? "" : "s"} remaining`,
  partsLabel: "parts",
  questionsLabel: "questions",
  minutesLabel: "min",
  typeIcons: { reading: "R", speaking: "S", writing: "W", listening: "L", full_mock: "FM", final_test: "FT" } satisfies Record<ExamModuleType, string>,
  typeDetail: {
    reading: "5 parts · 30 auto-marked questions · 50 minutes",
    speaking: "4 equal-weight parts · five examiner criteria · 14 minutes",
    writing: "2 examiner-marked tasks · 32 marks each · 50 minutes",
    listening: "4 parts · 30 questions · MP3 or browser-narrated text",
    full_mock: "Listening, Reading, Writing and Speaking · 15 parts",
    final_test: "Complete final assessment · all four skills · 15 parts",
  } satisfies Record<ExamModuleType, string>,
} as const;
