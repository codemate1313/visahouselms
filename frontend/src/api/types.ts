export interface SuperAdminAccount {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  force_password_reset: boolean;
  dob?: string | null;
  phone_number?: string | null;
  address?: string | null;
  avatar_path?: string | null;
  created_at: string;
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

export type IeltsSection = "listening" | "reading" | "writing" | "speaking";
export type QuestionType = "mcq_single" | "mcq_multiple" | "true_false_not_given" | "yes_no_not_given" | "short_answer" | "fill_blank" | "essay" | "speaking_prompt";

export interface QuestionOption {
  key: string;
  text: string;
}

export interface QuestionDraft {
  question_type: QuestionType;
  prompt: string;
  instructions: string | null;
  passage: string | null;
  options: QuestionOption[];
  correct_answers: string[];
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

export interface QuestionImportPreview {
  source_type: "pdf" | "csv";
  source_filename: string;
  source_text: string;
  questions: QuestionDraft[];
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
export type ExamModuleStatus = "draft" | "published" | "archived";

export interface ModuleRubricCriterion {
  criterion: string;
  max_marks: number;
  description: string;
}

export interface ExamModuleAsset {
  id: number;
  module_id: number;
  part_id: number;
  asset_type: "mp3" | "tts_mp3" | "avatar_mp4";
  title: string;
  original_filename: string;
  url: string;
  mime_type: string;
  file_size: number;
  transcript: string | null;
  tts_voice: string | null;
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
  answer_constraints: {
    allowed_question_types?: QuestionType[];
    max_answer_words?: number;
    minimum_words?: number;
    maximum_words?: number;
    audio_plays?: number;
    audio_required?: boolean;
  };
  rubric: ModuleRubricCriterion[];
  sort_order: number;
  questions: ExamModuleQuestion[];
  assets: ExamModuleAsset[];
}

export interface ExamModule {
  id: number;
  module_type: ExamModuleType;
  module_label: string;
  title: string;
  description: string | null;
  instructions: string | null;
  status: ExamModuleStatus;
  is_visible: boolean;
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
  entitled: boolean;
}

export interface StudentCurrentPlan {
  plan: {
    id: number;
    name: string;
    description: string | null;
    modules: StudentPlanModule[];
  } | null;
  state: "none" | "active" | "grace" | "expired";
  expires_at: string | null;
  access_type: "institute" | "direct";
}

export type AttemptStatus = "ready" | "in_progress" | "submitted" | "grading" | "graded" | "expired";

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
  options: QuestionOption[];
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
  asset_type: "mp3" | "tts_mp3" | "avatar_mp4";
  title: string;
  url: string;
  mime_type: string;
  transcript: string | null;
}

export interface AttemptPartGradeView {
  criteria: { criterion: string; max_marks: string; marks_awarded: string; cefr_level: CefrLevel }[];
  total_marks: string | null;
  comment: string | null;
  status: "pending" | "graded";
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

export type CefrLevel = "Below B1" | "B1" | "B2" | "C1" | "C2";

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
  level: CefrLevel | null;
  level_label: string;
  descriptor: string;
  mapping_method: "configured_raw_score" | "local_percentage" | null;
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
    aggregation: "lowest_completed_skill";
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
  max_marks: string | null;
  rubric: ModuleRubricCriterion[];
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
  course_id: number | null;
  status: AttemptStatus;
  is_final: boolean;
  security_required: boolean;
  security_authorized: boolean;
  security_started_at: string | null;
  security_last_heartbeat_at: string | null;
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
  parts: AttemptPart[];
}

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

export interface StudentNotification {
  id: number;
  kind: "grade_released" | "announcement_published";
  attempt_id: number | null;
  announcement_id: number | null;
  link_url: string | null;
  title: string;
  message: string;
  read_at: string | null;
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
