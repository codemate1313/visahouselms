import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface BlogAdminItem {
  id: number;
  title: string;
  slug: string;
  category: string;
  author_name: string;
  read_time_minutes: number;
  is_published: boolean;
  created_at: string;
}

export function SuperAdminBlogs() {
  const [blogs, setBlogs] = useState<BlogAdminItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlogs = () => {
    setLoading(true);
    fetch("/api/v1/super-admin/blogs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setBlogs(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchBlogs();
  }, []);

  const handleDelete = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this blog article?")) return;
    fetch(`/api/v1/super-admin/blogs/${id}`, { method: "DELETE" }).then((res) => {
      if (res.ok) fetchBlogs();
    });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CMS Educational Blogs Management</h1>
          <p className="text-sm text-gray-500">Publish, edit, or manage educational IELTS preparation articles and SEO content.</p>
        </div>
        <Link
          to="/super-admin/blogs/new"
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition"
        >
          + Write New Blog Post
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading blog posts...</div>
      ) : blogs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No blog posts found. Click "+ Write New Blog Post" to add one.</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-slate-900 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">Title &amp; Slug</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Author</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
              {blogs.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-700/30 transition">
                  <td className="px-4 py-3">
                    <div className="font-bold text-gray-900 dark:text-white">{b.title}</div>
                    <div className="text-xs text-rose-600 dark:text-rose-400 font-mono">/blogs/{b.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-slate-700 rounded-md text-xs font-semibold">
                      {b.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{b.author_name}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                        b.is_published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {b.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{new Date(b.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link to={`/blogs/${b.slug}`} target="_blank" className="text-xs text-gray-500 hover:underline">
                        View
                      </Link>
                      <Link to={`/super-admin/blogs/${b.id}`} className="text-xs text-indigo-600 font-semibold hover:underline">
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id)}
                        className="text-xs text-rose-600 font-semibold hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
