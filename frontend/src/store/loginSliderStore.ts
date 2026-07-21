import { create } from "zustand";

export interface LoginSlide {
  id: string;
  imageUrl: string;
  badge: string;
  title: string;
  subtitle: string;
}

const DEFAULT_SLIDES: LoginSlide[] = [
  {
    id: "slide-1",
    imageUrl: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=1200&auto=format&fit=crop",
    badge: "IELTS LMS PLATFORM",
    title: "Smart Evaluation & Institute Analytics",
    subtitle: "Empowering institutes and students with real-time IELTS scoring, automated grading, and comprehensive analytics.",
  },
  {
    id: "slide-2",
    imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop",
    badge: "ACADEMIC EXCELLENCE",
    title: "Interactive Practice & AI Mock Tests",
    subtitle: "Deliver authentic computer-delivered IELTS exam environments with live speaking evaluation and instant feedback.",
  },
  {
    id: "slide-3",
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=1200&auto=format&fit=crop",
    badge: "GLOBAL LEARNING HUB",
    title: "Seamless Student & Instructor Portals",
    subtitle: "Track candidate progress, manage subscriptions, and deliver world-class learning modules across your branch network.",
  },
];

const STORAGE_KEY = "visahouselms_login_slides";

function loadSavedSlides(): LoginSlide[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load saved login slides", e);
  }
  return DEFAULT_SLIDES;
}

interface LoginSliderState {
  slides: LoginSlide[];
  updateSlide: (id: string, updated: Partial<LoginSlide>) => void;
  addSlide: (slide: Omit<LoginSlide, "id">) => void;
  removeSlide: (id: string) => void;
  resetSlides: () => void;
}

export const useLoginSliderStore = create<LoginSliderState>((set) => ({
  slides: loadSavedSlides(),

  updateSlide: (id, updated) => {
    set((state) => {
      const newSlides = state.slides.map((s) => (s.id === id ? { ...s, ...updated } : s));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSlides));
      return { slides: newSlides };
    });
  },

  addSlide: (newSlideData) => {
    set((state) => {
      const newSlide: LoginSlide = {
        ...newSlideData,
        id: `slide-${Date.now()}`,
      };
      const newSlides = [...state.slides, newSlide];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSlides));
      return { slides: newSlides };
    });
  },

  removeSlide: (id) => {
    set((state) => {
      if (state.slides.length <= 1) return state;
      const newSlides = state.slides.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSlides));
      return { slides: newSlides };
    });
  },

  resetSlides: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ slides: DEFAULT_SLIDES });
  },
}));
