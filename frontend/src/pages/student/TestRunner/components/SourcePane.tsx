import type { RefObject } from "react";
import { API_BASE_URL } from "@/api/client";
import { SpeakingAvatar } from "@/components/speaking/SpeakingAvatar";
import type { Attempt } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";

interface SourcePaneProps {
  attemptId: number;
  currentPart: Attempt["parts"][number];
  passages: string[];
  sourcePaneRef: RefObject<HTMLElement | null>;
}

export function SourcePane({ attemptId, currentPart, passages, sourcePaneRef }: SourcePaneProps) {
  const t = strings.sourcePane;
  const sectionLabels = strings.sectionLabels;
  return (
    <section className="test-runner-source-pane" ref={sourcePaneRef}>
      <div className="test-runner-pane-heading">
        <span>{currentPart.part_code.replaceAll("_", " ")}</span>
        <h2>{passages.length > 0 ? t.sourceMaterial : t.partInstructions}</h2>
        {currentPart.skill_focus && <p>{currentPart.skill_focus}</p>}
      </div>
      {currentPart.section_type === "speaking" && <SpeakingAvatar attemptId={attemptId} partId={currentPart.id} />}
      {currentPart.instructions && <p className="test-runner-instructions">{currentPart.instructions}</p>}
      {currentPart.assets.map((asset) => (
        <div className="test-runner-asset" key={asset.id}>
          <p>{asset.title}</p>
          {asset.asset_type === "avatar_mp4" ? (
            <video controls src={`${API_BASE_URL}${asset.url}`} />
          ) : (
            <audio controls src={`${API_BASE_URL}${asset.url}`} />
          )}
        </div>
      ))}
      {passages.length > 0 ? (
        passages.map((passage, index) => (
          <article className="test-runner-passage" key={`${currentPart.id}-${index}`}>
            {passages.length > 1 && (
              <strong>
                {t.passagePrefix} {index + 1}
              </strong>
            )}
            <p>{passage}</p>
          </article>
        ))
      ) : (
        <div className="test-runner-source-placeholder">
          <strong>
            {sectionLabels[currentPart.section_type as keyof typeof sectionLabels]} {t.taskSuffix}
          </strong>
          <p>{t.defaultInstructions}</p>
        </div>
      )}
    </section>
  );
}
