/*
 * API payload shapes. Domain vocabularies (statuses, sections, attempt
 * states, CEFR levels) are declared in `@/constants` and re-exported here,
 * so the runtime values and these types can never drift apart.
 */

import type { AttemptStatus, CefrLevel, ExamModuleStatus, ExamSection, IeltsSection } from "@/constants";

export type { AttemptStatus, CefrLevel, ExamModuleStatus, ExamSection, IeltsSection };
export interface SuperAdminAccount {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  force_password_reset: boolean;
  is_owner?: boolean;
  is_developer_verified?: boolean;
  can_view_monetary_analytics?: boolean;
  role_name?: string | null;
  dob?: string | null;
  phone_number?: string | null;
  address?: string | null;
  avatar_path?: string | null;
  created_at: string;
}

export type SupportTicketStatus = "new" | "open" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high";
export type SupportTicketQueue = "institute" | "super_admin";

export interface SupportTicketMessage {
  id: number;
  ticket_id: number;
  sender_id: number | null;
  sender_name: string;
  sender_role: "customer" | "admin" | "staff" | string;
  message: string;
  attachments?: string[] | null;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  source: string;
  name: string;
  email: string;
  phone_number: string | null;
  institute_name: string | null;
  subject: string;
  message: string;
  category: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  admin_note: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  requester_id: number | null;
  institute_id: number | null;
  queue: SupportTicketQueue;
  escalated_at: string | null;
  escalated_by_id: number | null;
  escalated_by_name: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  closed_by_role?: string | null;
  messages?: SupportTicketMessage[];
}

export interface SupportTicketListResponse {
  items: SupportTicket[];
  total: number;
  page: number;
  page_size: number;
  counts: Record<SupportTicketStatus | "all", number>;
}

export interface PortalSupportTicket {
  id: number;
  subject: string;
  message: string;
  category: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  admin_note: string | null;
  queue: SupportTicketQueue;
  escalated_at: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  closed_by_role?: string | null;
  messages?: SupportTicketMessage[];
}

export interface InstructorAccount {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  force_password_reset: boolean;
  title: string;
  bio: string | null;
  dob?: string | null;
  phone_number?: string | null;
  address?: string | null;
  avatar_path?: string | null;
  gender?: string | null;
  created_at: string;
}

export interface InstructorAccountCreated extends InstructorAccount {
  temporary_password: string;
}

export interface InstructorPasswordReset {
  temporary_password: string;
}

export interface CourseAsset {
  id: number;
  course_id: number;
  asset_type: "pdf" | "audio";
  title: string;
  original_filename: string;
  file_url: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  created_at: string;
}

export interface CourseAssignment {
  id: number;
  institute_id: number;
  institute_name: string;
  course_id: number;
  is_active: boolean;
  assigned_at: string;
}

export interface CourseModuleLink {
  id: number;
  module_id: number;
  module_type: string;
  title: string;
  status: "draft" | "published" | "archived";
  duration_minutes: number;
  sort_order: number;
}

export interface Course {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  level: string;
  estimated_duration_minutes: number | null;
  price: string;
  currency: string;
  status: "draft" | "published" | "archived";
  is_featured: boolean;
  is_visible: boolean;
  created_by_id: number;
  created_by_name: string;
  created_by_email: string;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  asset_count: number;
  assignment_count: number;
  assets: CourseAsset[];
  assignments?: CourseAssignment[];
  modules: CourseModuleLink[];
}

export type QuestionType = "mcq_single" | "mcq_multiple" | "true_false_not_given" | "yes_no_not_given" | "short_answer" | "fill_blank" | "matching_unique" | "matching_reusable" | "essay" | "speaking_prompt";

export interface QuestionOption {
  key: string;
  text: string;
}

export type SpeakingTurnType = "identity" | "topic_question" | "roleplay_response" | "roleplay_initiate" | "read_aloud" | "follow_up" | "presentation";

export interface QuestionInteraction {
  group_label?: string | null;
  turn_type?: SpeakingTurnType | null;
  preparation_seconds?: number | null;
  response_seconds?: number | null;
  adaptive_follow_up?: boolean;
  /* Speaking 2 only: the situation the examiner announces before she asks the
     question, and the pause she leaves between the two. Kept apart from the
     prompt because a single spoken line cannot hold a pause. */
  heading?: string | null;
  heading_gap_seconds?: number | null;
  audio_path?: string | null;
  audio_url?: string | null;
  candidate_material_type?: "none" | "text" | "image" | "pdf" | null;
  candidate_material_path?: string | null;
  candidate_material_url?: string | null;
  candidate_material_name?: string | null;
}

export interface QuestionDraft {
  question_type: QuestionType;
  prompt: string;
  instructions: string | null;
  part_heading?: string | null;
  target_part?: string;
  passage: string | null;
  image_path: string | null;
  image_url?: string | null;
  options: QuestionOption[];
  correct_answers: string[];
  interaction?: QuestionInteraction;
  explanation: string | null;
  points: number | string;
  difficulty: "easy" | "medium" | "hard";
  warnings?: string[];
}

export interface Question extends Omit<QuestionDraft, "points"> {
  id: number;
  bank_id: number;
  points: string;
  source_type: "manual" | "pdf" | "csv";
  source_filename: string | null;
  created_by_id: number;
  created_at: string;
  updated_at: string | null;
  bank_title?: string;
  section?: IeltsSection;
  link_id?: number;
  sort_order?: number;
  points_override?: string | null;
}

export interface QuestionBank {
  id: number;
  course_id: number;
  course_title: string;
  title: string;
  description: string | null;
  section: IeltsSection;
  created_by_id: number;
  created_by_name: string;
  question_count: number;
  created_at: string;
  updated_at: string | null;
  questions?: Question[];
}

export interface ModuleImportPreviewPart {
  part_id: number;
  part_code: string;
  part_title: string;
  part_heading?: string | null;
  instructions?: string | null;
  section_type: IeltsSection;
  layout?: string | null;
  allowed_question_types: QuestionType[];
  existing_count: number;
  remaining_slots: number | null;
  questions: QuestionDraft[];
  question_count: number;
}

export interface ModuleImportPreview {
  source_type: "pdf" | "csv";
  source_filename: string;
  source_text: string;
  parts: ModuleImportPreviewPart[];
  part_headings?: Record<string, string>;
  question_count: number;
  warning_count: number;
  warnings: string[];
}

export interface Assessment {
  id: number;
  course_id: number;
  course_title: string;
  title: string;
  description: string | null;
  assessment_type: "practice" | "module_mock" | "full_mock" | "final";
  status: "draft" | "published" | "archived";
  duration_minutes: number | null;
  instructions: string | null;
  created_by_id: number;
  created_by_name: string;
  question_count: number;
  total_points: string;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  questions?: Question[];
}

export type ExamModuleType = "reading" | "speaking" | "writing" | "listening" | "full_mock" | "final_test";

export interface ModuleRubricCriterion {
  criterion: string;
  max_marks: number;
  description: string;
  weight?: number;
}

export interface ExamModuleAsset {
  id: number;
  module_id: number;
  part_id: number;
  asset_type: "mp3" | "tts_text" | "tts_mp3" | "avatar_mp4";
  title: string;
  original_filename: string;
  url: string | null;
  mime_type: string;
  file_size: number;
  transcript: string | null;
  tts_voice: string | null;
  tts_rate: string | null;
  created_at: string;
}

export interface ExamModuleQuestion extends QuestionDraft {
  id: number;
  part_id: number;
  points: string;
  source_type: "manual" | "pdf" | "csv";
  source_filename: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string | null;
}

export interface ExamModulePart {
  id: number;
  module_id: number;
  section_type: IeltsSection;
  part_code: string;
  title: string;
  skill_focus: string;
  instructions: string | null;
  question_limit: number | null;
  minimum_questions: number;
  max_marks: string | null;
  duration_minutes: number | null;
  auto_marked: boolean;
  ai_evaluation_enabled: boolean;
  answer_constraints: {
    allowed_question_types?: QuestionType[];
    max_answer_words?: number;
    minimum_words?: number;
    maximum_words?: number;
    audio_plays?: number;
    audio_required?: boolean;
    preparation_seconds?: number;
    response_seconds?: number;
    option_count?: number;
    passage_required?: boolean;
    shared_passage?: boolean;
    shared_options?: boolean;
    unique_answers?: boolean;
    multi_answer_allowed?: boolean;
    minimum_inference_questions?: number;
    score_weight?: number;
    notes_allowed?: boolean;
    preserve_question_order?: boolean;
    preserve_option_order?: boolean;
    layout?: "shared_cloze" | "conversation_groups" | "notepad_gaps" | "inline_matching_blanks" | "source_text_matching";
    group_count?: number;
    questions_per_group?: number;
    group_label_required?: boolean;
    inline_marker_required?: boolean;
    interaction_mode?: "ai_interlocutor";
    required_turn_types?: SpeakingTurnType[];
    allowed_turn_types?: SpeakingTurnType[];
    /* Turns that may appear at most once in the part - the single read-aloud
       text, the single presentation stimulus. Every other allowed turn is a
       bank the examiner draws from, repeatable as often as the author needs:
       no speaking part carries a `maximum_questions` ceiling. */
    singleton_turn_types?: SpeakingTurnType[];
    maximum_questions?: number;
    /* Whether this part's prompts may carry a heading the examiner speaks
       before the question, and the pause used when a prompt sets none. */
    spoken_heading?: boolean;
    default_heading_gap_seconds?: number;
    /* Per-turn preparation/response defaults the authoring form pre-fills. A
       Speaking 3 read-aloud and its follow-ups share a part but not a clock, so
       the default cannot live on the part itself. */
    turn_timings?: Partial<Record<SpeakingTurnType, { preparation_seconds: number; response_seconds: number }>>;
    suggested_preparation_seconds?: number;
    suggested_response_seconds?: number;
    audio_mode?: "single" | "per_question";
  };
  rubric: ModuleRubricCriterion[];
  sort_order: number;
  questions: ExamModuleQuestion[];
  assets: ExamModuleAsset[];
}

export interface OnboardingInstruction {
  id: string;
  title: string;
  description: string;
  icon?: string;
}

export interface ExamModule {
  id: number;
  module_type: ExamModuleType;
  module_label: string;
  title: string;
  description: string | null;
  instructions: string | null;
  show_onboarding_instructions?: boolean;
  onboarding_instructions?: OnboardingInstruction[];
  status: ExamModuleStatus;
  is_visible: boolean;
  /** Free sample test: students without a subscription may sit it. */
  is_demo?: boolean;
  deleted_at: string | null;
  assignment_count: number;
  duration_minutes: number;
  blueprint_version: string;
  source_module_ids: number[];
  created_by_id: number;
  created_by_name: string;
  part_count: number;
  question_count: number;
  audio_count: number;
  ready_to_publish: boolean;
  validation_errors: string[];
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  assessment?: Record<string, unknown>;
  parts?: ExamModulePart[];
}

export interface ModuleBlueprintPart {
  part_code: string;
  section_type: IeltsSection;
  title: string;
  skill_focus: string;
  instructions: string | null;
  question_limit: number | null;
  minimum_questions: number;
  max_marks: number | null;
  auto_marked: boolean;
  ai_evaluation_enabled: boolean;
  answer_constraints: ExamModulePart["answer_constraints"];
  rubric: ModuleRubricCriterion[];
}

export interface ModuleBlueprint {
  module_type: ExamModuleType;
  label: string;
  duration_minutes: number;
  parts: ModuleBlueprintPart[];
  assessment: Record<string, unknown>;
}

export interface TTSVoice {
  id: string;
  label: string;
}

/* ---------- Student portal / attempts / grading (Phase 3.4) ---------- */

export interface StudentPlanModule {
  id?: number;
  module_id?: number;
  title: string;
  module_type: ExamModuleType;
  duration_minutes: number;
  status?: ExamModuleStatus;
  is_locked?: boolean;
  is_demo?: boolean;
  has_attempted?: boolean;
  is_exhausted?: boolean;
  latest_attempt_id?: number | null;
  latest_attempt_status?: string | null;
  retake_available?: boolean;
  /** Per-module validity. Plans stack, so two plans that both contain Writing
   *  leave it running longer than either alone - a single plan-level expiry
   *  cannot express that, which is why this is on the module. */
  access_expires_at?: string | null;
  access_days_remaining?: number | null;
  /** Sittings bought and not yet used. Buying a plan again buys another go, so
   *  a card must not say "Attempt Exhausted" over a test Start would open. */
  sittings_remaining?: number;
}

export interface StudentPlanCatalogItem {
  id: number;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  duration_days: number;
  module_count: number;
  modules: StudentPlanModule[];
  features?: string[];
  entitled: boolean;
  /** When a held plan runs out. Null when the plan is not held. A purchased
   *  card that cannot say when it ends leaves the student guessing about
   *  when they may renew. */
  entitled_until?: string | null;
  is_international_enabled?: boolean;
  usd_price?: string | null;
  gst_rate_id?: number | null;
  gst_rate?: {
    id: number;
    name: string;
    percentage: number;
    tax_type: "exclusive" | "inclusive";
  } | null;
  is_popular?: boolean;
}



export interface StudentAiQuotaSummary {
  ai_evaluations_used: number;
  ai_evaluations_limit: number;
  ai_evaluations_left: number;
  ai_evaluations_got: number;
  ai_enabled: boolean;
}

export interface AiEvaluationHistoryItem {
  id: number;
  attempt_id: number;
  module_id: number | null;
  module_title: string;
  module_type: string | null;
  part_id: number;
  part_title: string;
  section_type: string | null;
  status: string;
  provider: string;
  model: string | null;
  created_at: string | null;
  overall_band: string | null;
  is_current_month?: boolean;
}

export interface AiEvaluationHistoryResponse {
  quota: StudentAiQuotaSummary;
  history: AiEvaluationHistoryItem[];
}

export interface StudentCurrentPlan {
  plan: {
    id: number;
    name: string;
    description: string | null;
    modules: StudentPlanModule[];
  } | null;
  state: "none" | "active" | "grace" | "expired" | "scheduled";
  expires_at: string | null;
  starts_at?: string | null;
  institute_name?: string | null;
  access_type: "institute" | "direct";
  ai_evaluations?: StudentAiQuotaSummary;
  demo?: {
    state: "active" | "locked";
    is_enabled: boolean;
    days_remaining: number | null;
    duration_days: number;
    tests_taken: number;
    course_limit: number;
    locked_reason: string | null;
    module_ids?: number[];
  };
}


export interface AttemptResponse {
  selected?: string | string[];
  text?: string;
  recorded?: boolean;
}

export interface AttemptQuestion {
  id: number;
  question_type: QuestionType;
  prompt: string;
  instructions: string | null;
  passage: string | null;
  image_url: string | null;
  options: QuestionOption[];
  interaction: QuestionInteraction;
  points: string;
  sort_order: number;
  response: AttemptResponse | null;
  audio_path: string | null;
  revision: number;
  correct_answers?: string[];
  explanation?: string | null;
  is_correct?: boolean | null;
  points_awarded?: string | null;
}

export interface AttemptAsset {
  id: number;
  part_id: number;
  asset_type: "mp3" | "tts_text" | "tts_mp3" | "avatar_mp4";
  title: string;
  url: string | null;
  mime_type: string;
  transcript: string | null;
  tts_voice: string | null;
  tts_rate: string | null;
}

export interface AttemptPartGradeView {
  criteria: { criterion: string; max_marks: string; marks_awarded: string; cefr_level: CefrLevel; rationale?: string }[];
  total_marks: string | null;
  comment: string | null;
  status: "pending" | "draft" | "graded" | "ai_graded";
}

export interface ReevaluationRequestView {
  id: number;
  attempt_id: number;
  student_name: string;
  module_title: string;
  reason: string;
  status: "pending" | "in_review" | "resolved" | "rejected";
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  resolution_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface RetakeRequestView {
  id: number;
  attempt_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  module_title: string;
  module_type: ExamModuleType;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by_id: number | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  consumed_at: string | null;
}

export interface GradingQueueMetadata {
  id: number;
  status: "pending" | "claimed" | "completed";
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  routing_reason: string;
  priority: number;
  due_at: string | null;
  claimed_at: string | null;
  completed_at: string | null;
  created_at?: string | null;
}

export interface AiEvaluationSuggestion {
  id: number;
  criteria: Array<{ criterion: string; max_marks: string; marks_awarded: string; cefr_level: CefrLevel; rationale: string }>;
  comment: string;
  confidence: string;
  human_review_required: true;
  framework_version: string;
  policy_version: string;
}


export interface CefrScaleAnchor {
  level: CefrLevel;
  marks: string;
  descriptor: string;
}

export interface CefrSkillResult {
  skill: IeltsSection;
  label: string;
  status: "pending" | "complete";
  part_count: number;
  raw_score: string;
  max_score: string;
  percentage: string;
  scaled_score: string;
  level: CefrLevel | null;
  level_label: string;
  descriptor: string;
  mapping_method: "languagecert_practice_scale" | null;
}

export interface CefrProfile {
  framework: "CEFR";
  framework_version: string;
  policy_version: string;
  status: "provisional" | "complete";
  overall: {
    level: CefrLevel;
    label: string;
    descriptor: string;
    scaled_score: string;
    aggregation: "equal_completed_skill_average";
  } | null;
  skills: CefrSkillResult[];
  source_url: string;
  calibration_note: string;
}

export interface StudentBadge {
  code: string;
  name: string;
  description: string;
  icon: string;
  criteria: Record<string, string | number>;
  earned: boolean;
  awarded_at: string | null;
  attempt_id: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  attempts_count: number;
  average_percentage: string;
  best_cefr_level: CefrLevel | null;
  is_current_student: boolean;
}

export interface StudentLeaderboard {
  scope: "institute" | "direct_student";
  period?: "all_time";
  entries: LeaderboardEntry[];
  current_student: LeaderboardEntry | null;
  message: string | null;
}

export interface AttemptPart {
  id: number;
  section_type: IeltsSection;
  part_code: string;
  title: string;
  skill_focus: string;
  instructions: string | null;
  duration_minutes: number | null;
  auto_marked: boolean;
  ai_evaluation_enabled: boolean;
  max_marks: string | null;
  rubric: ModuleRubricCriterion[];
  answer_constraints: {
    allowed_question_types?: QuestionType[];
    max_answer_words?: number;
    preparation_seconds?: number;
    response_seconds?: number;
    option_count?: number;
    score_weight?: number;
    notes_allowed?: boolean;
    layout?: "shared_cloze" | "conversation_groups" | "notepad_gaps" | "inline_matching_blanks" | "source_text_matching";
    group_count?: number;
    questions_per_group?: number;
    group_label_required?: boolean;
    inline_marker_required?: boolean;
    interaction_mode?: "ai_interlocutor";
    required_turn_types?: SpeakingTurnType[];
    allowed_turn_types?: SpeakingTurnType[];
    audio_mode?: "single" | "per_question";
  };
  cefr_scale: CefrScaleAnchor[];
  sort_order: number;
  assets: AttemptAsset[];
  question_count: number;
  answered_count: number;
  questions: AttemptQuestion[];
  grade: AttemptPartGradeView | null;
}

export interface Attempt {
  id: number;
  module_id: number;
  module_type: ExamModuleType;
  module_title: string;
  duration_minutes?: number;
  show_onboarding_instructions?: boolean;
  onboarding_instructions?: OnboardingInstruction[] | null;
  course_id: number | null;
  status: AttemptStatus;
  is_final: boolean;
  security_required: boolean;
  security_authorized: boolean;
  security_started_at: string | null;
  security_last_heartbeat_at: string | null;
  security_heartbeat_sequence: number;
  security_risk_score: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  raw_score: string | null;
  max_score: string | null;
  band_label: string | null;
  cefr_level: CefrLevel | null;
  cefr_profile: CefrProfile | null;
  cefr_policy_version: string | null;
  graded_at: string | null;
  flag_count: number;
  reevaluation: ReevaluationRequestView | null;
  retake_request: RetakeRequestView | null;
  ai_evaluation_status: "not_started" | "disabled" | "pending" | "completed" | "manual_required";
  parts: AttemptPart[];
}

export type AnalysisBandStatus = "strong" | "steady" | "priority" | "pending";

export interface StudentResultAnalysis {
  generated_by: "configured_ai" | "cefr_analysis_engine";
  ai_enabled: boolean;
  summary: string;
  strengths: string[];
  improvements: string[];
  next_steps: string[];
  metrics: {
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
    pending: number;
    unanswered: number;
  };
  section_metrics: Array<{
    skill: IeltsSection;
    label: string;
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
    pending: number;
    percentage: string;
    cefr_level: string | null;
  }>;
  /* The four cuts the coaching is built from - see student_analysis_service.
     Optional so a cached analysis written by the previous version still
     renders. */
  part_breakdown?: Array<{
    part_code: string;
    label: string;
    skill: IeltsSection;
    skill_label: string;
    focus: string;
    auto_marked: boolean;
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    marks: string | null;
    percentage: string;
    status: AnalysisBandStatus;
  }>;
  question_type_breakdown?: Array<{
    type: string;
    label: string;
    tests: string;
    correct: number;
    total: number;
    unanswered: number;
    percentage: string;
    status: AnalysisBandStatus;
  }>;
  difficulty_breakdown?: Array<{
    difficulty: string;
    label: string;
    correct: number;
    total: number;
    percentage: string;
    status: AnalysisBandStatus;
  }>;
  criteria_breakdown?: Array<{
    part_label: string;
    skill: IeltsSection;
    criterion: string;
    marks: string;
    percentage: string;
    status: AnalysisBandStatus;
    action: string;
  }>;
  focus_areas?: Array<{
    title: string;
    detail: string;
    action: string;
    metric: string;
  }>;
  pacing?: {
    minutes_used: number;
    minutes_allowed: number;
    share: string;
    note: string | null;
  } | null;
  progression?: {
    current_level: string;
    current_score: string;
    next_level: string | null;
    target_score: string | null;
    points_to_next: string | null;
  } | null;
  framework_version: string;
}

export interface AttemptSummary {
  id: number;
  module_id: number;
  module_type: ExamModuleType;
  module_title: string;
  status: AttemptStatus;
  security_required: boolean;
  security_risk_score: number;
  started_at: string;
  submitted_at: string | null;
  raw_score: string | null;
  max_score: string | null;
  band_label: string | null;
  cefr_level: CefrLevel | null;
  cefr_profile: CefrProfile | null;
}

export type StudentNotificationKind =
  | "grade_released"
  | "announcement_published"
  | "support_ticket_created"
  | "support_ticket_updated"
  | "support_ticket_assigned"
  | "ai_quota_exhausted"
  | "ai_evaluation_failed"
  | "grading_queue_routed"
  | "grading_claimed"
  | "grading_released"
  | "reevaluation_requested"
  | "reevaluation_claimed"
  | "reevaluation_resolved"
  | "retake_requested"
  | "retake_resolved"
  | "system_job_failed"
  | "system_security_event";

export interface StudentNotification {
  id: number;
  kind: StudentNotificationKind;
  attempt_id: number | null;
  announcement_id: number | null;
  link_url: string | null;
  title: string;
  message: string;
  read_at: string | null;
  pinned_at: string | null;
  created_at: string;
  module_title: string | null;
  module_type: ExamModuleType | null;
  raw_score: string | null;
  max_score: string | null;
  band_label: string | null;
  cefr_level: CefrLevel | null;
}

export interface Announcement {
  id: number;
  institute_id: number | null;
  title: string;
  message: string;
  audience: string;
  status: "draft" | "published" | "scheduled";
  published_at: string | null;
  scheduled_at: string | null;
  expires_at: string | null;
  target_institute_ids?: number[];
  target_user_ids?: number[];
  created_at: string;
}

export interface TargetInstituteOption {
  id: number;
  name: string;
  slug: string;
  is_active?: boolean;
  onboarding_status?: string;
}

export interface TargetStudentOption {
  id: number;
  name: string;
  email: string;
  institute_id?: number | null;
}


export type ProctorFlagType =
  | "blur"
  | "visibility_change"
  | "fullscreen_exit"
  | "camera_stopped"
  | "microphone_stopped"
  | "screen_share_stopped"
  | "screen_surface_invalid"
  | "concurrent_tab"
  | "clipboard"
  | "print_attempt"
  | "context_menu"
  | "ip_change";

export interface GradingQueueItem {
  id: number;
  user_id: number;
  student_name: string;
  module_id: number;
  module_title: string;
  module_type: ExamModuleType;
  status: AttemptStatus;
  submitted_at: string | null;
  flag_count: number;
  parts_to_grade: number;
  queue: GradingQueueMetadata;
  is_reevaluation: boolean;
}

export interface GradingDetail extends Attempt {
  student_name: string;
  student_email: string;
  flags: {
    flag_type: ProctorFlagType;
    severity: "low" | "medium" | "high" | "critical";
    occurred_at: string;
    client_occurred_at: string | null;
    meta: Record<string, unknown> | null;
  }[];
  queue: GradingQueueMetadata;
  ai_assistance: {
    enabled: boolean;
    configured: boolean;
    provider: string;
    model: string | null;
    monthly_limit: number;
  };
}

export interface GradingAdminOverview {
  queue: { pending: number; claimed: number; completed: number };
  ai_usage: { period: string; used: number; limit: number; scopes: number };
  reevaluations: ReevaluationRequestView[];
}

export interface AvatarSettings {
  provider: string | null;
  api_key: string | null;
  presenter_image_url: string | null;
  voice_id: string | null;
}

/** Roles listed in the Super Admin user directory, in tab order. */
export const DIRECTORY_ROLES = [
  "SUPER_ADMIN",
  "SA_INSTRUCTOR",
  "INSTITUTE_ADMIN",
  "INST_INSTRUCTOR",
  "STUDENT",
] as const;

export type DirectoryRole = (typeof DIRECTORY_ROLES)[number];

export interface DirectoryUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role_name: DirectoryRole;
  is_active: boolean;
  force_password_reset: boolean;
  is_owner: boolean;
  avatar_path: string | null;
  institute_id: number | null;
  institute_name: string | null;
  institute_slug: string | null;
  phone_number?: string | null;
  address?: string | null;
  created_at: string;
  deleted_at: string | null;
  /** Null while the account is still on the password it was created with. */
  password_changed_at: string | null;
  last_password_change: LastPasswordChange | null;
}

/** Newest entry in an account's password trail, read from the audit log. */
export interface LastPasswordChange {
  at: string;
  action: string;
  by_self: boolean;
  by_name: string | null;
  ip_address: string | null;
}

export interface DirectoryUserPage {
  items: DirectoryUser[];
  total: number;
  page: number;
  page_size: number;
  role_counts: Record<DirectoryRole, number>;
}

export interface UserLinkedSession {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  is_active: boolean;
}

export interface UserLinkedEnrollment {
  id: number;
  course_title: string;
  source: string;
  granted_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export interface UserLinkedAttempt {
  id: number;
  module_title: string;
  status: AttemptStatus;
  is_final: boolean;
  started_at: string | null;
  submitted_at: string | null;
  raw_score: number | null;
  max_score: number | null;
  band_label: string | null;
  cefr_level: CefrLevel | null;
}

export interface UserLinkedSubscription {
  id: number;
  plan_title: string;
  starts_at: string | null;
  expires_at: string | null;
  grace_days: number;
  cancelled_at: string | null;
}

export interface UserLinkedPayment {
  id: number;
  amount: number;
  final_amount: number;
  gateway: string;
  gateway_reference: string | null;
  status: string;
  created_at: string | null;
  paid_at: string | null;
  invoice_number: string | null;
}

export interface UserLinkedAuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
  ip_address: string | null;
  actor: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    role_name: DirectoryRole | null;
  } | null;
}

export interface UserInstructorMetrics {
  pending_grading_count: number;
  claimed_grading_count: number;
  completed_grading_count: number;
  total_graded_parts_count: number;
}

export interface UserLinkedDetails {
  user: DirectoryUser;
  sessions: UserLinkedSession[];
  enrollments: UserLinkedEnrollment[];
  attempts: UserLinkedAttempt[];
  subscriptions: UserLinkedSubscription[];
  payments: UserLinkedPayment[];
  audit_logs: UserLinkedAuditLog[];
  instructor_metrics: UserInstructorMetrics | null;
}
