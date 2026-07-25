import { Link } from "react-router-dom";
import { contentWorkspaceStrings as strings } from "./ContentWorkspace.strings";

export function ContentWorkspace() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{strings.title}</h1>
          <p className="page-subtitle">{strings.subtitle}</p>
        </div>
      </div>
      <div className="content-area-grid">
        {strings.areas.map((area) => (
          <section className="content-area-card" key={area.name}>
            <span className="phase-chip">{strings.areaTypeLabel}</span>
            <h2>{area.name}</h2>
            <p>{area.detail}</p>
            <Link className="button-link" to={`/super-admin/instructor/modules/new/${area.type}`}>
              {strings.createCta(area.name)}
            </Link>
          </section>
        ))}
      </div>
    </div>
  );
}
