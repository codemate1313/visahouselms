export interface HeroSlide {
  badge: string;
  heading: string;
  highlight: string;
  desc: string;
  image: string;
  ctaText: string;
  ctaLink: string;
  altText: string;
  altLink: string;
  stats: { value: string; label: string }[];
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    badge: "AI Evaluator Live · 15,000+ Students Prepared",
    heading: "Master Language CERT with Real Exam Simulations",
    highlight: " & Exam Timers.",
    desc: "Authentic computer-delivered test environments — with exact Language CERT timing, section tracking, and auto-saving interfaces.",
    image: "/images/slide_simulation.jpg",
    ctaText: "Sign up for free",
    ctaLink: "/register",
    altText: "View plans & pricing →",
    altLink: "/plans",
    stats: [
      { value: "15,000+", label: "Students prepared" },
      { value: "180+", label: "Partner institutes" },
      { value: "98.4%", label: "Target band rate" },
    ],
  },
  {
    badge: "Instant AI Score Feedback · Speaks & Essays",
    heading: "Instant Speaking & Writing Analysis",
    highlight: " & CEFR Bands.",
    desc: "Our advanced neural networks evaluate pronunciation, grammatical accuracy, coherence, and task response with pinpoint accuracy.",
    image: "/images/slide_ai_feedback.jpg",
    ctaText: "Try Speaking Demo",
    ctaLink: "/login",
    altText: "Learn about AI scoring →",
    altLink: "#modules",
    stats: [
      { value: "Band 8.5", label: "Average speaking score" },
      { value: "Real-time", label: "Speech-to-text conversion" },
      { value: "24/7", label: "Instant evaluation availability" },
    ],
  },
  {
    badge: "Detailed Learning Analytics & Dashboards",
    heading: "Track Your Journey to Your Dream Band",
    highlight: " & Performance Charts.",
    desc: "Interactive analytics dashboards isolate your weak areas and highlight vocabulary or speed gaps across all four Language CERT modules.",
    image: "/images/slide_progress.jpg",
    ctaText: "View Dashboard Demo",
    ctaLink: "/login",
    altText: "See how we track progress →",
    altLink: "#steps",
    stats: [
      { value: "Weak-spots", label: "Detected automatically" },
      { value: "Leaderboard", label: "Institute batch ranks" },
      { value: "One-Click", label: "PDF report downloads" },
    ],
  },
];

export interface ModuleCard {
  num: string;
  title: string;
  desc: string;
  g1: string;
  wash1: string;
  wash2: string;
  status: string;
  kind: "listening" | "reading" | "writing" | "speaking";
}

export const MODULE_CARDS: ModuleCard[] = [
  {
    num: "01",
    title: "Listening Simulations",
    desc: "High-fidelity native-accent audio with section progress, waveform seeking and answer autocommit.",
    g1: "#e11d2e",
    wash1: "rgba(225, 29, 46,0.10)",
    wash2: "rgba(225, 29, 46,0.02)",
    status: "Audio playing",
    kind: "listening",
  },
  {
    num: "02",
    title: "Reading Passages",
    desc: "Split-screen passage view with live highlighter, T/F/NG, matching headings and summary completion.",
    g1: "#7c5cff",
    wash1: "rgba(124,92,255,0.10)",
    wash2: "rgba(124,92,255,0.02)",
    status: "Highlight active",
    kind: "reading",
  },
  {
    num: "03",
    title: "Writing Assessor",
    desc: "Task 1 & 2 editor with live word counter, AI scoring across TR, CC, LR & GRA, and grammar fixes.",
    g1: "#00b8e6",
    wash1: "rgba(0,184,230,0.10)",
    wash2: "rgba(0,184,230,0.02)",
    status: "Word count synced",
    kind: "writing",
  },
  {
    num: "04",
    title: "Speaking Evaluator",
    desc: "Part 1–3 voice recording with speech-to-text, lexical density, pace and fluency scoring.",
    g1: "#22c55e",
    wash1: "rgba(34,197,94,0.10)",
    wash2: "rgba(34,197,94,0.02)",
    status: "Recording live",
    kind: "speaking",
  },
];

export interface StepCard {
  num: string;
  title: string;
  desc: string;
  points: string[];
}

export const STEP_CARDS: StepCard[] = [
  {
    num: "01",
    title: "Take a timed mock",
    desc: "Sit a full computer-delivered test identical to the real exam — timed and autosaving.",
    points: ["Real LanguageCert exam layout", "Autosaves every answer", "Focus & fullscreen tracked"],
  },
  {
    num: "02",
    title: "Get instant feedback",
    desc: "Objective sections mark automatically; writing and speaking get AI-drafted CEFR bands.",
    points: ["AI drafts across TR, CC, LR, GRA", "Human examiner confirms every mark", "Per-skill CEFR level assigned"],
  },
  {
    num: "03",
    title: "Track and improve",
    desc: "Per-skill progress, weak-area detection and institute leaderboards guide every session.",
    points: ["Weak-area detector alerts", "Institute-only leaderboard", "One-click PDF report cards"],
  },
];

export interface TestimonialCard {
  quote: string;
  name: string;
  role: string;
  score: string;
  init: string;
  avatar: string;
  grad: string;
}
