import type { Attempt } from "@/api/types";
import { attemptResultDetailsStrings as strings } from "../AttemptResultDetails.strings";

interface CefrProfilePanelProps {
  profile: NonNullable<Attempt["cefr_profile"]>;
}

export function CefrProfilePanel({ profile }: CefrProfilePanelProps) {
  const t = strings.cefr;
  return (
    <section className="cefr-result" aria-labelledby="cefr-result-title">
      <div className="cefr-result-header">
        <div>
          <span className="page-eyebrow">{profile.framework_version}</span>
          <h2 id="cefr-result-title">CEFR proficiency profile</h2>
          <p>{profile.overall?.descriptor ?? t.overallPendingDescriptor}</p>
        </div>
        <div className={`cefr-overall ${profile.overall ? "is-complete" : "is-pending"} grade-${profile.overall?.label ? profile.overall.label.replace(/\s+/g, "-").toLowerCase() : ""}`}>
          <span>{t.overallLabel}</span>
          <strong>{profile.overall?.label ?? t.pending}</strong>
        </div>
      </div>

      <div className="cefr-skill-grid">
        {profile.skills.map((skill) => {
          const skillGradeClass = skill.level_label ? skill.level_label.replace(/\s+/g, "-").toLowerCase() : "";
          return (
            <article
              key={skill.skill}
              className={`${skill.status === "pending" ? "is-pending" : ""} grade-card-${skillGradeClass}`}
            >
              <div className="cefr-skill-heading">
                <div>
                  <span>{skill.label}</span>
                  <strong className={`skill-grade-label grade-text-${skillGradeClass}`}>
                    {skill.level_label}
                  </strong>
                </div>
                <span>{skill.status === "complete" ? `${skill.percentage}%` : t.awaitingExaminer}</span>
              </div>
              <div className="cefr-meter" aria-label={`${skill.label} ${skill.percentage}%`}>
                <span style={{ width: `${Math.min(100, Number(skill.percentage))}%` }} />
              </div>
              <p>{skill.descriptor}</p>
              <small>
                {skill.raw_score} / {skill.max_score} {t.marksSuffix}
              </small>
            </article>
          );
        })}
      </div>

      <div className="cefr-result-note">
        <p>{profile.calibration_note}</p>
        <a href={profile.source_url} target="_blank" rel="noreferrer">
          {t.sourceLink}
        </a>
      </div>
    </section>
  );
}
