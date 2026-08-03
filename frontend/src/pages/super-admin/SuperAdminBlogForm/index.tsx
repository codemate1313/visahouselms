import { type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import "./SuperAdminBlogForm.css";
import { blogFormDefaults } from "./SuperAdminBlogForm.strings";
import { slugify } from "./helpers";
import type { BlogFormData, BlogRecord } from "./types";
import { FormHeader } from "./components/FormHeader";
import { MainContentFields } from "./components/MainContentFields";
import { MediaMetadataPanel } from "./components/MediaMetadataPanel";

export function SuperAdminBlogForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<BlogFormData>(blogFormDefaults);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    apiClient
      .get<BlogRecord[]>("/super-admin/blogs")
      .then(({ data }) => {
        const item = data.find((b) => String(b.id) === String(id));
        if (item) {
          setFormData(item);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, isEdit]);

  function handleFieldChange<K extends keyof BlogFormData>(field: K, value: BlogFormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleTitleChange(newTitle: string) {
    const generatedSlug = slugify(newTitle);
    setFormData((prev) => ({
      ...prev,
      title: newTitle,
      slug: prev.slug && isEdit ? prev.slug : generatedSlug,
      meta_title: prev.meta_title ? prev.meta_title : `${newTitle} | IELTS LMS`,
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    const request = isEdit
      ? apiClient.put(`/super-admin/blogs/${id}`, formData)
      : apiClient.post("/super-admin/blogs", formData);

    request
      .then(() => {
        setLoading(false);
        navigate("/super-admin/blogs");
      })
      .catch(() => setLoading(false));
  }

  return (
    <div className="sab-form-container">
      <FormHeader isEdit={isEdit} loading={loading} />

      <form id="blog-article-form" onSubmit={handleSubmit}>
        <div className="sab-form-layout">
          <MainContentFields formData={formData} onTitleChange={handleTitleChange} onFieldChange={handleFieldChange} />
          <MediaMetadataPanel formData={formData} onFieldChange={handleFieldChange} />
        </div>
      </form>
    </div>
  );
}
