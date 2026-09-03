/**
 * Domain enumerations shared across portals.
 *
 * Each domain declares, in one place:
 *   1. a `*_VALUES` record — the wire values the API accepts/returns;
 *   2. a derived union type, so the type can never drift from the values;
 *   3. a `*_LABELS` map — the display text for those values;
 *   4. an `*_OPTIONS` array ready for `SearchableSelect`.
 *
 * Import these instead of re-typing literals like `"published"` or rebuilding
 * an options array per filter bar. Page-specific wording still belongs in that
 * page's `*.strings.ts`; what lives here is the vocabulary of the domain
 * itself, which must read identically everywhere it appears.
 */

import { toOptions } from "./options";
import type { BadgeTone } from "@/components/ui";

/* ------------------------------------------------------------------------ */
/* Exam module lifecycle                                                     */
/* ------------------------------------------------------------------------ */

export const EXAM_MODULE_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type ExamModuleStatus = (typeof EXAM_MODULE_STATUS)[keyof typeof EXAM_MODULE_STATUS];

export const EXAM_MODULE_STATUS_LABELS: Readonly<Record<ExamModuleStatus, string>> = {
  [EXAM_MODULE_STATUS.DRAFT]: "Draft",
  [EXAM_MODULE_STATUS.PUBLISHED]: "Published",
  [EXAM_MODULE_STATUS.ARCHIVED]: "Archived",
};

export const ALL_STATUSES_LABEL = "All statuses";
export const EXAM_MODULE_STATUS_OPTIONS = toOptions(
  EXAM_MODULE_STATUS_LABELS,
  ALL_STATUSES_LABEL,
);

/* ------------------------------------------------------------------------ */
/* Activation state (institutes, coupons, payment methods, accounts)         */
/* ------------------------------------------------------------------------ */

export const ACTIVATION_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type ActivationStatus = (typeof ACTIVATION_STATUS)[keyof typeof ACTIVATION_STATUS];

export const ACTIVATION_STATUS_LABELS: Readonly<Record<ActivationStatus, string>> = {
  [ACTIVATION_STATUS.ACTIVE]: "Active",
  [ACTIVATION_STATUS.INACTIVE]: "Inactive",
};

export const ACTIVATION_STATUS_OPTIONS = toOptions(ACTIVATION_STATUS_LABELS, ALL_STATUSES_LABEL);

/**
 * Some endpoints model activation as a boolean rather than a status string, so
 * the filter has to submit `"true"`/`"false"`. Kept beside the string form on
 * purpose — the two used to be spelled out separately on every screen.
 */
export const BOOLEAN_ACTIVE_LABELS: Readonly<Record<"true" | "false", string>> = {
  true: ACTIVATION_STATUS_LABELS.active,
  false: ACTIVATION_STATUS_LABELS.inactive,
};

export const ANY_STATUS_LABEL = "Any status";
export const BOOLEAN_ACTIVE_OPTIONS = toOptions(BOOLEAN_ACTIVE_LABELS, ANY_STATUS_LABEL);

/* ------------------------------------------------------------------------ */
/* Catalogue lifecycle (plans and other sellable catalogues)                 */
/* ------------------------------------------------------------------------ */

export const CATALOGUE_STATUS = {
  ACTIVE: "active",
  DRAFT: "draft",
  INACTIVE: "inactive",
} as const;

export type CatalogueStatus = (typeof CATALOGUE_STATUS)[keyof typeof CATALOGUE_STATUS];

export const CATALOGUE_STATUS_LABELS: Readonly<Record<CatalogueStatus, string>> = {
  [CATALOGUE_STATUS.ACTIVE]: "Active",
  [CATALOGUE_STATUS.DRAFT]: "Draft",
  [CATALOGUE_STATUS.INACTIVE]: "Inactive",
};

export const CATALOGUE_STATUS_OPTIONS = toOptions(CATALOGUE_STATUS_LABELS, ALL_STATUSES_LABEL);

/* ------------------------------------------------------------------------ */
/* Institute account state                                                   */
/* ------------------------------------------------------------------------ */

export const INSTITUTE_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  DRAFT: "draft",
} as const;

export type InstituteStatus = (typeof INSTITUTE_STATUS)[keyof typeof INSTITUTE_STATUS];

export const INSTITUTE_STATUS_LABELS: Readonly<Record<InstituteStatus, string>> = {
  [INSTITUTE_STATUS.ACTIVE]: "Active",
  [INSTITUTE_STATUS.SUSPENDED]: "Suspended",
  [INSTITUTE_STATUS.DRAFT]: "Draft",
};

export const INSTITUTE_STATUS_OPTIONS = toOptions(INSTITUTE_STATUS_LABELS, ALL_STATUSES_LABEL);

/* ------------------------------------------------------------------------ */
/* Subscription lifecycle                                                    */
/* ------------------------------------------------------------------------ */

export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  /** Past the end date but still usable during the configured grace window. */
  GRACE: "grace",
  EXPIRED: "expired",
  /** Renewed early: a term that starts when the running one ends. Not access
   *  yet - the term covering today is what grants it. */
  SCHEDULED: "scheduled",
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const SUBSCRIPTION_STATUS_LABELS: Readonly<Record<SubscriptionStatus, string>> = {
  [SUBSCRIPTION_STATUS.ACTIVE]: "Active",
  [SUBSCRIPTION_STATUS.GRACE]: "Grace period",
  [SUBSCRIPTION_STATUS.EXPIRED]: "Expired",
  [SUBSCRIPTION_STATUS.SCHEDULED]: "Scheduled",
};

/** Badge class per state, including the two states that are not filterable
 *  (an institute with none, and a cancelled term). One map, because a state
 *  that reads green on one screen and grey on the next is a bug. */
export const SUBSCRIPTION_STATE_BADGES: Readonly<Record<string, BadgeTone>> = {
  [SUBSCRIPTION_STATUS.ACTIVE]: "green",
  [SUBSCRIPTION_STATUS.GRACE]: "amber",
  [SUBSCRIPTION_STATUS.EXPIRED]: "red",
  [SUBSCRIPTION_STATUS.SCHEDULED]: "blue",
  cancelled: "gray",
  none: "gray",
};

export const ALL_SUBSCRIPTIONS_LABEL = "All subscriptions";
export const SUBSCRIPTION_STATUS_OPTIONS = toOptions(
  SUBSCRIPTION_STATUS_LABELS,
  ALL_SUBSCRIPTIONS_LABEL,
);

/* ------------------------------------------------------------------------ */
/* Coupon scope                                                              */
/* ------------------------------------------------------------------------ */

export const COUPON_SCOPE = {
  ALL: "all",
  PLAN: "plan",
  COURSE: "course",
} as const;

export type CouponScope = (typeof COUPON_SCOPE)[keyof typeof COUPON_SCOPE];

export const COUPON_SCOPE_LABELS: Readonly<Record<CouponScope, string>> = {
  [COUPON_SCOPE.ALL]: "All plans",
  [COUPON_SCOPE.PLAN]: "Specific plan",
  [COUPON_SCOPE.COURSE]: "Specific course",
};

export const ALL_SCOPES_LABEL = "All scopes";
export const COUPON_SCOPE_OPTIONS = toOptions(COUPON_SCOPE_LABELS, ALL_SCOPES_LABEL);

/* ------------------------------------------------------------------------ */
/* Exam sections (Listening, Reading, Writing, Speaking)                   */
/* ------------------------------------------------------------------------ */

export const EXAM_SECTION = {
  LISTENING: "listening",
  READING: "reading",
  WRITING: "writing",
  SPEAKING: "speaking",
} as const;

export const IELTS_SECTION = EXAM_SECTION;

export type ExamSection = (typeof EXAM_SECTION)[keyof typeof EXAM_SECTION];
export type IeltsSection = ExamSection;

/** Standard section order. */
export const EXAM_SECTION_LABELS: Readonly<Record<ExamSection, string>> = {
  [EXAM_SECTION.LISTENING]: "Listening",
  [EXAM_SECTION.READING]: "Reading",
  [EXAM_SECTION.WRITING]: "Writing",
  [EXAM_SECTION.SPEAKING]: "Speaking",
};

export const IELTS_SECTION_LABELS = EXAM_SECTION_LABELS;

export const ALL_SECTIONS_LABEL = "All sections";
export const EXAM_SECTION_OPTIONS = toOptions(EXAM_SECTION_LABELS, ALL_SECTIONS_LABEL);
export const IELTS_SECTION_OPTIONS = EXAM_SECTION_OPTIONS;

/* ------------------------------------------------------------------------ */
/* Question difficulty                                                       */
/* ------------------------------------------------------------------------ */

export const DIFFICULTY = {
  EASY: "easy",
  MEDIUM: "medium",
  HARD: "hard",
} as const;

export type Difficulty = (typeof DIFFICULTY)[keyof typeof DIFFICULTY];

export const DIFFICULTY_LABELS: Readonly<Record<Difficulty, string>> = {
  [DIFFICULTY.EASY]: "Easy",
  [DIFFICULTY.MEDIUM]: "Medium",
  [DIFFICULTY.HARD]: "Hard",
};

export const ALL_DIFFICULTIES_LABEL = "All difficulties";
export const DIFFICULTY_OPTIONS = toOptions(DIFFICULTY_LABELS, ALL_DIFFICULTIES_LABEL);

/* ------------------------------------------------------------------------ */
/* Attempt lifecycle                                                         */
/* ------------------------------------------------------------------------ */

export const ATTEMPT_STATUS = {
  READY: "ready",
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  GRADING: "grading",
  GRADED: "graded",
  EXPIRED: "expired",
  VIOLATED: "violated",
} as const;

export type AttemptStatus = (typeof ATTEMPT_STATUS)[keyof typeof ATTEMPT_STATUS];

export const ATTEMPT_STATUS_LABELS: Readonly<Record<AttemptStatus, string>> = {
  [ATTEMPT_STATUS.READY]: "Ready",
  [ATTEMPT_STATUS.IN_PROGRESS]: "In progress",
  [ATTEMPT_STATUS.SUBMITTED]: "Submitted",
  [ATTEMPT_STATUS.GRADING]: "Grading",
  [ATTEMPT_STATUS.GRADED]: "Graded",
  [ATTEMPT_STATUS.VIOLATED]: "Test violated",
  [ATTEMPT_STATUS.EXPIRED]: "Expired",
};

export const ATTEMPT_STATUS_OPTIONS = toOptions(ATTEMPT_STATUS_LABELS, ALL_STATUSES_LABEL);

/* ------------------------------------------------------------------------ */
/* CEFR levels                                                               */
/* ------------------------------------------------------------------------ */

export const CEFR_LEVELS = ["Pre-A1", "A1", "A2", "B1", "B2", "C1", "C2"] as const;

export type CefrLevel = (typeof CEFR_LEVELS)[number];
