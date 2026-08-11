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
    badge: "Realistic Computer-Based Practice · Expert-Led Preparation",
    heading: "Prepare Smarter. Perform Better. Your LanguageCert Journey.",
    highlight: " Built for Success.",
    desc: "LanguageCert LMS brings preparation together in one place — from realistic mock tests and skill-based practice to detailed performance tracking and feedback.",
    image: "/images/slide_simulation.jpg",
    ctaText: "Sign up for free",
    ctaLink: "/register",
    altText: "View plans and vouchers →",
    altLink: "/plans",
    stats: [
      { value: "100+", label: "Students prepared" },
      { value: "20+", label: "Partner institutes" },
      { value: "4.9/5", label: "Target band rate" },
    ],
  },
  {
    badge: "Structured Practice · CEFR-Aligned Feedback",
    heading: "Everything You Need to Prepare",
    highlight: " With Confidence.",
    desc: "Practise listening, reading, writing and speaking with structured resources designed around your target level and real progress.",
    image: "/images/slide_ai_feedback.jpg",
    ctaText: "Start practising",
    ctaLink: "/login",
    altText: "Explore practice tools →",
    altLink: "#modules",
    stats: [
      { value: "CEFR", label: "Aligned profile" },
      { value: "4 Skills", label: "Practice coverage" },
      { value: "24/7", label: "Dashboard access" },
    ],
  },
  {
    badge: "Built by Visa House · 10+ Years of Experience",
    heading: "Built for Institutes.",
    highlight: " Trusted by Educators.",
    desc: "Give trainers the tools to manage learning, give students a realistic digital practice environment and give your institute clear visibility into performance.",
    image: "/images/slide_progress.jpg",
    ctaText: "Book a Platform Demo",
    ctaLink: "/login",
    altText: "See how progress tracking works →",
    altLink: "#steps",
    stats: [
      { value: "20K+", label: "Students prepared" },
      { value: "1000+", label: "Visa successes" },
      { value: "Leaderboard", label: "Institute batch ranks" },
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
    title: "Realistic Mock Tests",
    desc: "Experience computer-based practice designed to help you become comfortable with the format, timing and pressure of the real test.",
    g1: "#e11d2e",
    wash1: "rgba(225, 29, 46,0.10)",
    wash2: "rgba(225, 29, 46,0.02)",
    status: "Practice ready",
    kind: "listening",
  },
  {
    num: "02",
    title: "Listening & Reading Practice",
    desc: "Build accuracy, speed and comprehension with structured practice designed around your target level.",
    g1: "#7c5cff",
    wash1: "rgba(124,92,255,0.10)",
    wash2: "rgba(124,92,255,0.02)",
    status: "Skill builder",
    kind: "reading",
  },
  {
    num: "03",
    title: "Writing Feedback",
    desc: "Practise your writing and understand where you are losing marks with structured feedback against key assessment criteria.",
    g1: "#00b8e6",
    wash1: "rgba(0,184,230,0.10)",
    wash2: "rgba(0,184,230,0.02)",
    status: "Feedback available",
    kind: "writing",
  },
  {
    num: "04",
    title: "Speaking Practice",
    desc: "Develop fluency, pronunciation and confidence through focused speaking practice and performance feedback.",
    g1: "#22c55e",
    wash1: "rgba(34,197,94,0.10)",
    wash2: "rgba(34,197,94,0.02)",
    status: "Practice speaking",
    kind: "speaking",
  },
  {
    num: "05",
    title: "Track Your Progress",
    desc: "See your performance across every skill, identify weaknesses and understand exactly where you need to improve.",
    g1: "#f59e0b",
    wash1: "rgba(245,158,11,0.10)",
    wash2: "rgba(245,158,11,0.02)",
    status: "Progress mapped",
    kind: "reading",
  },
  {
    num: "06",
    title: "Expert Guidance",
    desc: "Learn with preparation strategies shaped by experienced trainers and Visa House's years of working with international students.",
    g1: "#14b8a6",
    wash1: "rgba(20,184,166,0.10)",
    wash2: "rgba(20,184,166,0.02)",
    status: "Trainer-led",
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
    desc: "Sit a full computer-based LanguageCert mock with realistic timing, audio and autosaving.",
    points: ["Real LanguageCert exam layout", "Autosaves every answer", "Focus & fullscreen tracked"],
  },
  {
    num: "02",
    title: "Get instant feedback",
    desc: "Objective sections mark automatically; writing and speaking feedback helps you understand the next improvement.",
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
