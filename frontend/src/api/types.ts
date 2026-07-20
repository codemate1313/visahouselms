export interface SuperAdminAccount {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  force_password_reset: boolean;
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
  specializations: string[];
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
  created_by_id: number;
  created_by_name: string;
  created_by_email: string;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  asset_count: number;
  assignment_count: number;
  assets: CourseAsset[];
  assignments?: CourseAssignment[];
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
