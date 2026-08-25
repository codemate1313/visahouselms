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
    badge: "Designed for Students · Self-Paced Practice",
    heading: "Practice Smarter with\nFull-Length Mock Tests",
    highlight: " & Instant Scoring.",
    desc: "Practise timed mock tests across all 4 skills with instant scoring, answer explanations, and personal progress tracking.",
    image: "/images/hero_slide_1.png",
    ctaText: "Start Practising Free",
    ctaLink: "/register",
    altText: "View Student Plans →",
    altLink: "/plans",
    stats: [
      { value: "4 Skills", label: "All Exam Modules" },
      { value: "Instant", label: "AI Score & Feedback" },
      { value: "Full Mock", label: "Real Exam Simulations" },
    ],
  },
  {
    badge: "Interactive AI Practice · Real Audio",
    heading: "Prepare Smarter with Avatar Speaking\n& Real Exam Audio",
    highlight: " for Success.",
    desc: "Authentic listening audio and interactive Avatar speaking tests with instant AI evaluations to build exam confidence.",
    image: "/images/hero_slide_2.png",
    ctaText: "Explore Features",
    ctaLink: "#features",
    altText: "See How It Works →",
    altLink: "#steps",
    stats: [
      { value: "10+", label: "Years Experience" },
      { value: "1,000+", label: "Students Prepped" },
      { value: "24/7", label: "On-Demand Access" },
    ],
  },
  {
    badge: "For Institutes & Language Schools",
    heading: "Scale Your Institute with\nAdvanced Analytics",
    highlight: " & Cohort Tools.",
    desc: "Manage cohorts, assign CEFR-aligned question banks, and track student growth in real time.",
    image: "/images/hero_slide_3.png",
    ctaText: "Book an Institute Demo",
    ctaLink: "/contact?tab=partner",
    altText: "Partner with Visa House →",
    altLink: "/contact?tab=partner",
    stats: [
      { value: "CEFR", label: "Aligned Question Banks" },
      { value: "Real-Time", label: "Student Diagnostics" },
      { value: "Enterprise", label: "Cohort Management" },
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
    title: "Listening Practice",
    desc: "Realistic audio + timed practice + detailed analysis to build comprehension, accuracy and test pace.",
    ctaText: "Practise Listening →",
    ctaLink: "/register",
    g1: "#b80f28",
    wash1: "rgba(184, 15, 40, 0.10)",
    wash2: "rgba(184, 15, 40, 0.02)",
    kind: "mocks",
  },
  {
    num: "02",
    title: "Reading Practice",
    desc: "Full-length practice + question-level performance with CEFR-aligned passages and exam-style distractors.",
    ctaText: "Practise Reading →",
    ctaLink: "/register",
    g1: "#7c5cff",
    wash1: "rgba(124,92,255,0.10)",
    wash2: "rgba(124,92,255,0.02)",
    kind: "listening_reading",
  },
  {
    num: "03",
    title: "Writing Feedback",
    desc: "Task-based practice + structured feedback mapped across Task Fulfilment, Grammar and Lexical Resource.",
    ctaText: "Improve Your Writing →",
    ctaLink: "/register",
    g1: "#00b8e6",
    wash1: "rgba(0,184,230,0.10)",
    wash2: "rgba(0,184,230,0.02)",
    kind: "writing",
  },
  {
    num: "04",
    title: "Speaking with Avatar",
    desc: "Realistic speaking practice with Avatar + performance evaluation across fluency, vocabulary and pronunciation.",
    ctaText: "Practise Speaking →",
    ctaLink: "/register",
    g1: "#22c55e",
    wash1: "rgba(34,197,94,0.10)",
    wash2: "rgba(34,197,94,0.02)",
    kind: "speaking",
  },
  {
    num: "05",
    title: "Final Mock Tests",
    desc: "Experience the complete exam under realistic conditions with full 4-skill computer-based mock simulations.",
    ctaText: "Take a Mock Test →",
    ctaLink: "/register",
    g1: "#f59e0b",
    wash1: "rgba(245,158,11,0.10)",
    wash2: "rgba(245,158,11,0.02)",
    kind: "mocks",
  },
  {
    num: "06",
    title: "Performance Analytics",
    desc: "Discover where you're losing marks across skills and target the exact weak areas that need improvement.",
    ctaText: "View Analytics →",
    ctaLink: "/register",
    g1: "#ec4899",
    wash1: "rgba(236,72,153,0.10)",
    wash2: "rgba(236,72,153,0.02)",
    kind: "guidance",
  },
];

export interface StepCard {
  num: string;
  title: string;
  subtitle: string;
  desc: string;
  points: string[];
}

export const STEP_CARDS: StepCard[] = [
  {
    num: "01",
    title: "Take a realistic mock",
    subtitle: "Experience the test under timed computer-based conditions",
    desc: "Timed sections, computer-based interface, realistic audio, exam-style navigation and automated autosaving.",
    points: ["Real LanguageCert computer-based layout", "Timed sections & authentic-style audio", "Autosaves every answer & tracks pace"],
  },
  {
    num: "02",
    title: "Analyse your performance",
    subtitle: "Discover where you're losing marks across every skill",
    desc: "See how you performed across each skill and task type — not simply whether an answer was right or wrong.",
    points: ["TR, CC, LR & GRA score breakdowns", "Avatar speaking & pronunciation evaluation", "Question-level diagnostic performance reports"],
  },
  {
    num: "03",
    title: "Target weaknesses & repeat",
    subtitle: "Practise strategically and verify your score improvement",
    desc: "Target the areas that need improvement, take another mock, and verify that your performance actually improves.",
    points: ["Realistic task architecture & distractors", "CEFR-aligned progressive practice", "Verify measurable score improvement"],
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
