import { apiClient } from "./client";

export interface GrammarContentItem {
  id: number;
  title: string;
  description?: string | null;

  is_active: boolean;
  file_name: string;
  file_size: number;
  file_url: string;
  created_at: string;
  updated_at?: string | null;
}

export interface GrammarContentListResponse {
  items: GrammarContentItem[];
  total: number;
}

export const grammarContentApi = {
  // SA Instructor endpoints
  getInstructorContents: async (): Promise<GrammarContentListResponse> => {
    const response = await apiClient.get<GrammarContentListResponse>("/grammar-content/instructor/contents");
    return response.data;
  },

  createContent: async (formData: FormData): Promise<GrammarContentItem> => {
    const response = await apiClient.post<GrammarContentItem>(
      "/grammar-content/instructor/contents",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return response.data;
  },

  updateContent: async (id: number, formData: FormData): Promise<GrammarContentItem> => {
    const response = await apiClient.put<GrammarContentItem>(
      `/grammar-content/instructor/contents/${id}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return response.data;
  },

  toggleContentStatus: async (id: number): Promise<GrammarContentItem> => {
    const response = await apiClient.patch<GrammarContentItem>(
      `/grammar-content/instructor/contents/${id}/toggle`
    );
    return response.data;
  },

  deleteContent: async (id: number): Promise<void> => {
    await apiClient.delete(`/grammar-content/instructor/contents/${id}`);
  },

  // Student endpoints
  getStudentStudyMaterials: async (): Promise<GrammarContentListResponse> => {
    const response = await apiClient.get<GrammarContentListResponse>("/grammar-content/student/study-materials");
    return response.data;
  },
};
