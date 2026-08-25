export interface InstructorCourseUsage {
  module_id: number;
  title: string;
  module_type: string;
  learners: number;
  attempts: number;
  completed_attempts: number;
  completion_rate: number;
}

export interface InstructorTrendPoint {
  key: string;
  label: string;
  value: number;
}

export interface InstructorDashboardSummary {
  profile_completion: number;
  content: {
    modules: number;
    drafts: number;
    published: number;
    questions: number;
    audio: number;
    reading: number;
    speaking: number;
    writing: number;
    listening: number;
    full_mock: number;
    final_test: number;
  };
  grading: {
    pending: number;
    in_progress: number;
    completed_today: number;
    completed_this_month: number;
    completed_total: number;
  };
  engagement: {
    unique_learners: number;
    total_attempts: number;
    completed_attempts: number;
    courses_with_usage: number;
  };
  course_usage: InstructorCourseUsage[];
  grading_trend: InstructorTrendPoint[];
  recent_activity: {
    action: string;
    entity_type: string;
    entity_id: number | null;
    created_at: string | null;
  }[];
}
