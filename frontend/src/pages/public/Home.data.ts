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
    heading: "Prepare Smarter, Perform Better.\nYour LanguageCert Journey.",
    highlight: "\nBuilt for Success.",
    desc: "LanguageCert LMS brings your preparation together in one place — from realistic mock tests and skill-based practice to detailed performance tracking and feedback, backed by Visa House's decade of international education experience.",
    image: "/images/hero_slide_1.png",
    ctaText: "Book a Platform Demo",
    ctaLink: "/contact?tab=partner",
    altText: "View plans and vouchers →",
    altLink: "/plans",
    stats: [
      { value: "20K+", label: "Students prepared" },
      { value: "20+", label: "Partner institutes" },
      { value: "4.9/5", label: "Target band rate" },
    ],
  },
  {
    badge: "Built for Institutes · Trusted by Educators",
    heading: "Practice Smarter and Experience a Modern Testing Journey.",
    highlight: "\nDesigned for Success.",
    desc: "We build the environment, audio, timer and marking pipeline so students walk into the real LanguageCert having already sat forty realistic mocks.",
    image: "/images/hero_slide_2.png",
    ctaText: "Explore Features",
    ctaLink: "#features",
    altText: "Explore practice tools →",
    altLink: "#features",
    stats: [
      { value: "10+", label: "Years of Experience" },
      { value: "1000+", label: "Visa Successes" },
      { value: "Global", label: "Support" },
    ],
  },
  {
    badge: "Detailed Performance Analytics & Dashboards",
    heading: "Everything You Need to Prepare, Practice & Perform Your Best.",
    highlight: " \nwith Confidence.",
    desc: "Track student performance across every skill, identify weaknesses, and use examiner-authored question banks and CEFR-aligned profiles to guide progress.",
    image: "/images/hero_slide_3.png",
    ctaText: "Book a Demo",
    ctaLink: "/contact?tab=partner",
    altText: "See how we track progress →",
    altLink: "#steps",
    stats: [
      { value: "Examiner", label: "Authored Question Banks" },
      { value: "CEFR-Aligned", label: "Proficiency Profiles" },
      { value: "Institute-Only", label: "Leaderboards & Branding" },
    ],
  },
];

export interface ModuleCard {
  kind: string;
}

export interface FeatureCard {
  num: string;
  title: string;
  desc: string;
  ctaText: string;
  ctaLink: string;
  g1: string;
  wash1: string;
  wash2: string;
  kind: "mocks" | "listening_reading" | "writing" | "speaking" | "progress" | "guidance";
}

export const EVERYTHING_CARDS: FeatureCard[] = [
  {
    num: "01",
    title: "Realistic Mock Tests",
    desc: "Experience computer-based practice designed to help you become comfortable with the format, timing and pressure of the real test.",
    ctaText: "Practice →",
    ctaLink: "/register",
    g1: "#e11d2e",
    wash1: "rgba(225, 29, 46,0.10)",
    wash2: "rgba(225, 29, 46,0.02)",
    kind: "mocks",
  },
  {
    num: "02",
    title: "Listening & Reading Practice",
    desc: "Build accuracy, speed and comprehension with structured practice designed around your target level.",
    ctaText: "Improve Your Skills →",
    ctaLink: "/register",
    g1: "#7c5cff",
    wash1: "rgba(124,92,255,0.10)",
    wash2: "rgba(124,92,255,0.02)",
    kind: "listening_reading",
  },
  {
    num: "03",
    title: "Writing Feedback",
    desc: "Practise your writing and understand where you're losing marks with structured feedback against key assessment criteria.",
    ctaText: "Improve Your Writing →",
    ctaLink: "/register",
    g1: "#00b8e6",
    wash1: "rgba(0,184,230,0.10)",
    wash2: "rgba(0,184,230,0.02)",
    kind: "writing",
  },
  {
    num: "04",
    title: "Speaking Practice",
    desc: "Develop fluency, pronunciation and confidence through focused speaking practice and performance feedback.",
    ctaText: "Practise Speaking →",
    ctaLink: "/register",
    g1: "#22c55e",
    wash1: "rgba(34,197,94,0.10)",
    wash2: "rgba(34,197,94,0.02)",
    kind: "speaking",
  },
  {
    num: "05",
    title: "Track Your Progress",
    desc: "See your performance across every skill, identify weaknesses and understand exactly where you need to improve.",
    ctaText: "View Progress →",
    ctaLink: "/register",
    g1: "#f59e0b",
    wash1: "rgba(245,158,11,0.10)",
    wash2: "rgba(245,158,11,0.02)",
    kind: "progress",
  },
  {
    num: "06",
    title: "Expert Guidance",
    desc: "Learn with preparation strategies shaped by experienced trainers and Visa House's years of working with international students.",
    ctaText: "Learn More →",
    ctaLink: "/about",
    g1: "#ec4899",
    wash1: "rgba(236,72,153,0.10)",
    wash2: "rgba(236,72,153,0.02)",
    kind: "guidance",
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
