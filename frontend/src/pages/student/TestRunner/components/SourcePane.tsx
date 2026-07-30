import type { RefObject } from "react";
import { API_BASE_URL } from "@/api/client";
import { ListeningMediaAvatar } from "@/components/listening/ListeningMediaAvatar";
import type { Attempt } from "@/api/types";
import { testRunnerStrings as strings } from "../TestRunner.strings";

interface SourcePaneProps {
  currentPart: Attempt["parts"][number];
  passages: string[];
  sourcePaneRef: RefObject<HTMLElement | null>;
}

export function SourcePane({ currentPart, passages, sourcePaneRef }: SourcePaneProps) {
  const t = strings.sourcePane;
  const sectionLabels = strings.sectionLabels;
  return (
    <section className="test-runner-source-pane" ref={sourcePaneRef}>
      <div className="test-runner-pane-heading">
        <span>{currentPart.part_code.replaceAll("_", " ")}</span>
        <h2>{passages.length > 0 ? t.sourceMaterial : t.partInstructions}</h2>
        {currentPart.skill_focus && <p>{currentPart.skill_focus}</p>}
      </div>
      {currentPart.instructions && <p className="test-runner-instructions">{currentPart.instructions}</p>}
      {currentPart.assets.map((asset) => (
        <div className="test-runner-asset" key={asset.id}>
          {currentPart.section_type === "listening" ? (
            <ListeningMediaAvatar asset={asset} />
          ) : asset.asset_type === "avatar_mp4" && asset.url ? (
            <video controls src={`${API_BASE_URL}${asset.url}`} />
          ) : asset.url ? (
            <audio controls src={`${API_BASE_URL}${asset.url}`} />
          ) : null}
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
