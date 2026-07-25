export const blogDetailStrings = {
  seo: {
    fallbackTitle: "IELTS Blog Article",
    fallbackKeywords: "IELTS, Preparation",
  },
  loading: "Loading article details...",
  notFound: {
    title: "Article Not Found",
    description: "The blog article you are looking for might have been moved or removed.",
    backLink: "← Back to Blogs",
  },
  backToAll: "Back to All Articles",
  meta: {
    byLabel: "By",
    readTime: (minutes: number) => `${minutes} min read`,
    publishedLabel: "Published",
  },
} as const;
