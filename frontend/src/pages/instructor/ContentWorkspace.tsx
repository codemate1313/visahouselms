import { Link } from "react-router-dom";

const AREAS = [
  { name: "Courses", phase: "Available", detail: "Course catalog, B2C pricing, PDF/MP3 resources, and publishing.", href: "/instructor/courses" },
  { name: "Question banks", phase: "Available", detail: "Manual questions plus reviewable PDF and CSV extraction for every IELTS section.", href: "/instructor/question-banks" },
  { name: "Test builder", phase: "Available", detail: "Practice tests, module mocks, full mocks, final tests, timing, ordering, and scoring.", href: "/instructor/tests" },
];

export function ContentWorkspace() {
  return <div><div className="page-header"><div><h1>Content Workspace</h1><p className="page-subtitle">Create course resources, reusable question banks, and complete IELTS tests.</p></div></div><div className="content-area-grid">{AREAS.map((area) => <section className="content-area-card" key={area.name}><span className="phase-chip">{area.phase}</span><h2>{area.name}</h2><p>{area.detail}</p><Link className="button-link" to={area.href}>Open {area.name}</Link></section>)}</div></div>;
}
