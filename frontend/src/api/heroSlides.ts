import { apiClient } from "@/api/client";

export type HeroLocation = "home" | "login";

export interface HeroStat {
  value: string;
  label: string;
}

/** A slide as stored by the backend. The home hero uses every field; the
 * login/register hero only uses `badge`, `title`, `subtitle` and `image_url`. */
export interface HeroSlideRecord {
  id: number;
  location: HeroLocation;
  badge: string | null;
  title: string;
  highlight: string | null;
  subtitle: string | null;
  image_url: string;
  cta_text: string | null;
  cta_link: string | null;
  alt_text: string | null;
  alt_link: string | null;
  stats: HeroStat[];
  is_active: boolean;
  display_order: number;
  created_at?: string | null;
  updated_at?: string | null;
}

export type HeroSlideDraft = Omit<HeroSlideRecord, "id" | "created_at" | "updated_at">;

const PUBLIC_PATH = "/hero-slides";
const ADMIN_PATH = "/super-admin/hero-slides";

/** Rendered while the request is in flight and if it fails, so the login hero
 * is never blank. The backend seeds the same copy on first read. */
export const DEFAULT_LOGIN_SLIDES: HeroSlideRecord[] = [
  {
    id: -1,
    location: "login",
    badge: "Language CERT PLATFORM",
    title: "Smart Evaluation & Institute Analytics",
    highlight: null,
    subtitle:
      "Empowering institutes and students with real-time Language CERT scoring, automated grading, and comprehensive analytics.",
    image_url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
    cta_text: null,
    cta_link: null,
    alt_text: null,
    alt_link: null,
    stats: [],
    is_active: true,
    display_order: 0,
  },
  {
    id: -2,
    location: "login",
    badge: "ACADEMIC EXCELLENCE",
    title: "Interactive Practice & AI Mock Tests",
    highlight: null,
    subtitle:
      "Deliver authentic computer-delivered Language CERT exam environments with live speaking evaluation and instant feedback.",
    image_url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop",
    cta_text: null,
    cta_link: null,
    alt_text: null,
    alt_link: null,
    stats: [],
    is_active: true,
    display_order: 1,
  },
  {
    id: -3,
    location: "login",
    badge: "GLOBAL LEARNING HUB",
    title: "Seamless Student & Instructor Portals",
    highlight: null,
    subtitle:
      "Track candidate progress, manage subscriptions, and deliver world-class learning modules across your branch network.",
    image_url: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1200&auto=format&fit=crop",
    cta_text: null,
    cta_link: null,
    alt_text: null,
    alt_link: null,
    stats: [],
    is_active: true,
    display_order: 2,
  },
];

function normalize(slide: HeroSlideRecord): HeroSlideRecord {
  return { ...slide, stats: Array.isArray(slide.stats) ? slide.stats : [] };
}

/** Public, unauthenticated read used by the home and login heroes. */
export async function fetchPublicHeroSlides(location: HeroLocation): Promise<HeroSlideRecord[]> {
  const { data } = await apiClient.get<HeroSlideRecord[]>(PUBLIC_PATH, {
    params: { location },
    headers: { "X-Skip-Loader": "true" },
  });
  return Array.isArray(data) ? data.map(normalize) : [];
}

export async function fetchAdminHeroSlides(location: HeroLocation): Promise<HeroSlideRecord[]> {
  const { data } = await apiClient.get<HeroSlideRecord[]>(ADMIN_PATH, { params: { location } });
  return Array.isArray(data) ? data.map(normalize) : [];
}

export async function createHeroSlide(payload: HeroSlideDraft): Promise<HeroSlideRecord> {
  const { data } = await apiClient.post<HeroSlideRecord>(ADMIN_PATH, payload);
  return normalize(data);
}

export async function updateHeroSlide(id: number, payload: Partial<HeroSlideDraft>): Promise<HeroSlideRecord> {
  const { data } = await apiClient.put<HeroSlideRecord>(`${ADMIN_PATH}/${id}`, payload);
  return normalize(data);
}

export async function deleteHeroSlide(id: number): Promise<void> {
  await apiClient.delete(`${ADMIN_PATH}/${id}`);
}

export async function reorderHeroSlides(items: { id: number; display_order: number }[]): Promise<void> {
  await apiClient.put(`${ADMIN_PATH}/reorder`, items);
}

export async function resetHeroSlides(location: HeroLocation): Promise<HeroSlideRecord[]> {
  const { data } = await apiClient.post<HeroSlideRecord[]>(`${ADMIN_PATH}/reset`, null, { params: { location } });
  return Array.isArray(data) ? data.map(normalize) : [];
}

export function emptyHeroSlideDraft(location: HeroLocation): HeroSlideDraft {
  return {
    location,
    badge: location === "login" ? "Language CERT PLATFORM" : "",
    title: "",
    highlight: "",
    subtitle: "",
    image_url: "",
    cta_text: location === "home" ? "Start Practising Free" : "",
    cta_link: location === "home" ? "/register" : "",
    alt_text: location === "home" ? "View Student Plans →" : "",
    alt_link: location === "home" ? "/plans" : "",
    stats: [],
    is_active: true,
    display_order: 0,
  };
}
