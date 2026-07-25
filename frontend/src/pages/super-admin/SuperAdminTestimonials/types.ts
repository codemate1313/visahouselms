export interface TestimonialAdminItem {
  id: number;
  student_name: string;
  student_role?: string;
  target_score?: string;
  avatar_url?: string;
  rating: number;
  quote: string;
  is_active: boolean;
  display_order: number;
  created_at?: string;
}

export type TestimonialStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
export type TestimonialViewMode = "grid" | "table";

export interface DragReorderState {
  draggedIndex: number | null;
  dragOverIndex: number | null;
}
