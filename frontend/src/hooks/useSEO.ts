import { useEffect, useState } from "react";

export interface SEOSettingsData {
  site_name: string;
  default_title: string;
  title_template: string;
  default_meta_description: string;
  default_meta_keywords: string;
  default_og_image?: string;
  twitter_handle?: string;
  robots_txt?: string;
  custom_head_tags?: string;
}

export interface PageSEOOverride {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
}

const DEFAULT_SEO: SEOSettingsData = {
  site_name: "IELTS LMS Pro",
  default_title: "IELTS LMS Pro | Computer-Delivered Exam Platform & AI Feedback",
  title_template: "%s | IELTS LMS Pro",
  default_meta_description: "Experience authentic computer-delivered IELTS environments. Powered by instant AI Speaking evaluation, automated Writing feedback, and real-time institute tracking.",
  default_meta_keywords: "IELTS LMS, IELTS Practice, AI IELTS Evaluation, Computer Delivered IELTS",
  default_og_image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&q=80",
  twitter_handle: "@ieltslmspro",
};

export function useSEO(pageOverride?: PageSEOOverride) {
  const [seoData, setSeoData] = useState<SEOSettingsData>(DEFAULT_SEO);

  useEffect(() => {
    // Fetch live SEO settings from API
    fetch("/api/v1/seo-settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSeoData(data);
      })
      .catch(() => {
        // Fallback to DEFAULT_SEO
      });
  }, []);

  useEffect(() => {
    // Determine title
    let finalTitle = seoData.default_title;
    if (pageOverride?.title) {
      finalTitle = seoData.title_template
        ? seoData.title_template.replace("%s", pageOverride.title)
        : `${pageOverride.title} | ${seoData.site_name}`;
    }
    document.title = finalTitle;

    // Helper to set meta tags
    const setMetaTag = (selector: string, attr: string, value: string) => {
      let element = document.querySelector(selector);
      if (!element) {
        element = document.createElement("meta");
        const match = selector.match(/\[(name|property)="([^"]+)"\]/);
        if (match) {
          element.setAttribute(match[1], match[2]);
        }
        document.head.appendChild(element);
      }
      element.setAttribute(attr, value);
    };

    // Meta Description
    const finalDesc = pageOverride?.description || seoData.default_meta_description;
    setMetaTag('meta[name="description"]', "content", finalDesc);

    // Meta Keywords
    const finalKeywords = pageOverride?.keywords || seoData.default_meta_keywords;
    setMetaTag('meta[name="keywords"]', "content", finalKeywords);

    // OpenGraph Tags
    setMetaTag('meta[property="og:title"]', "content", finalTitle);
    setMetaTag('meta[property="og:description"]', "content", finalDesc);
    const finalOgImage = pageOverride?.ogImage || seoData.default_og_image || "";
    if (finalOgImage) {
      setMetaTag('meta[property="og:image"]', "content", finalOgImage);
    }
    setMetaTag('meta[property="og:site_name"]', "content", seoData.site_name);

    // Twitter Tags
    setMetaTag('meta[name="twitter:card"]', "content", "summary_large_image");
    setMetaTag('meta[name="twitter:title"]', "content", finalTitle);
    setMetaTag('meta[name="twitter:description"]', "content", finalDesc);
    if (seoData.twitter_handle) {
      setMetaTag('meta[name="twitter:site"]', "content", seoData.twitter_handle);
    }
  }, [seoData, pageOverride?.title, pageOverride?.description, pageOverride?.keywords, pageOverride?.ogImage]);

  return seoData;
}
