import { API_BASE_URL } from "@/api/client";
import type { Course } from "@/api/types";
import { courseAssignmentsStrings as strings } from "../CourseAssignments.strings";

interface CourseResourcesPanelProps {
  assets: Course["assets"];
}

export function CourseResourcesPanel({ assets }: CourseResourcesPanelProps) {
  const t = strings.resources;
  return (
    <section className="workspace-panel">
      <h2>{t.heading}</h2>
      {assets.length ? (
        <ul className="resource-links">
          {assets.map((asset) => (
            <li key={asset.id}>
              <span className={`asset-icon ${asset.asset_type}`}>{asset.asset_type.toUpperCase()}</span>
              <a href={`${API_BASE_URL}${asset.file_url}`} target="_blank" rel="noreferrer">
                {asset.title}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-message">{t.empty}</p>
      )}
    </section>
  );
}
