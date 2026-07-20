import { Link } from "react-router-dom";

const AREAS = [
  { name: "Reading", detail: "5 parts, 30 auto-marked questions and B1–C2 raw-score bands.", type: "reading" },
  { name: "Speaking", detail: "4 equal-weight parts assessed against five 0–8 criteria.", type: "speaking" },
  { name: "Writing", detail: "2 tasks assessed for achievement, grammar, vocabulary and organisation.", type: "writing" },
  { name: "Listening", detail: "4 parts with part-specific MP3 upload or text-to-speech generation.", type: "listening" },
  { name: "Full Mock Test", detail: "One complete 15-part assessment covering all four skills.", type: "full_mock" },
  { name: "Final Test", detail: "A final complete assessment with the same controlled blueprint.", type: "final_test" },
];

export function ContentWorkspace() {
  return <div><div className="page-header"><div><h1>Module Workspace</h1><p className="page-subtitle">Create one self-contained assessment module at a time.</p></div></div><div className="content-area-grid">{AREAS.map((area) => <section className="content-area-card" key={area.name}><span className="phase-chip">Module</span><h2>{area.name}</h2><p>{area.detail}</p><Link className="button-link" to={`/super-admin/instructor/modules/new/${area.type}`}>Create {area.name}</Link></section>)}</div></div>;
}
