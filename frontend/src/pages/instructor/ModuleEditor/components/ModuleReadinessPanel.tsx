import { useState, useRef, useEffect } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/Button/Button";
import type { ExamModule, ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";

interface ModuleReadinessPanelProps {
  module: ExamModule;
  busy: boolean;
  onChangeStatus: (status: "draft" | "published" | "archived") => void;
  onChoosePart?: (part: ExamModulePart) => void;
}

interface ParsedError {
  raw: string;
  tag: string;
  body: string;
}

function parseValidationError(errorStr: string): ParsedError {
  const match = errorStr.match(/^([A-Za-z0-9\s]+?)\s+(requires|takes|draws|needs|has)(.+)$/i);
  if (match) {
    const tag = match[1].trim();
    const rest = (match[2] + match[3]).trim().replace(/\.$/, "");
    return { raw: errorStr, tag, body: rest };
  }
  return { raw: errorStr, tag: "Requirement", body: errorStr };
}

export function ModuleReadinessPanel({ module, busy, onChangeStatus, onChoosePart }: ModuleReadinessPanelProps) {
  const t = strings.readiness;
  const isReady = module.ready_to_publish;
  const errors = module.validation_errors || [];
  const parsedErrors = errors.map(parseValidationError);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function handleCardClick(item: ParsedError) {
    const numMatch = item.tag.match(/\d+/);
    const partNum = numMatch ? Number(numMatch[0]) : null;

    const matchedPart = module.parts?.find(
      (p) =>
        p.title?.toLowerCase() === item.tag.toLowerCase() ||
        (partNum !== null && (p.part_code?.endsWith(`_${partNum}`) || p.sort_order === partNum || (p as { part_number?: number }).part_number === partNum))
    );

    if (matchedPart && onChoosePart) {
      onChoosePart(matchedPart);
    } else {
      const detailsEl = document.querySelector(".module-details") || document.querySelector(".module-authoring-layout");
      if (detailsEl) {
        detailsEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
    setIsOpen(false);
  }

  return (
    <div className="vh-readiness-popover-container" ref={containerRef}>
      {/* Header Pill Trigger Button */}
      <Button
        type="button"
        variant="ghost"
        className={`vh-readiness-header-pill ${isReady ? "is-ready" : "needs-work"} ${isOpen ? "is-open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title={isReady ? "Click to view readiness details" : "Click to view pending checklist"}
      >
        <span className="vh-status-dot" />
        <span className="vh-pill-label">{isReady ? t.ready : `${errors.length} Action Items`}</span>
        <Icon name="chevronDown" />
      </Button>

      {/* Direct Publish Button in Row Beside Ready Status */}
      {isReady && module.status === "draft" && (
        <Button
          type="button"
          variant="primary"
          className="vh-readiness-row-publish-btn"
          onClick={() => onChangeStatus("published")}
          disabled={busy}
          title="Publish module"
        >
          <span>{t.publish}</span>
          <Icon name="arrowRight" />
        </Button>
      )}

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="vh-readiness-popover-dropdown">
          <div className="vh-popover-header">
            <div className="vh-popover-title-row">
              <span className={`vh-readiness-status-badge ${isReady ? "is-ready" : "needs-work"}`}>
                <span className="vh-status-dot" />
                {isReady ? t.ready : t.needsWork}
              </span>
              <span className="vh-readiness-count-chip">
                {isReady ? "100% Validated" : `${errors.length} Pending`}
              </span>
            </div>
            <h3 className="vh-popover-heading">{isReady ? t.readyTitle : t.notReadyTitle}</h3>
          </div>

          {/* Validation Checklist Items */}
          {!isReady && errors.length > 0 && (
            <div className="vh-popover-checklist">
              {parsedErrors.map((item, index) => (
                <div
                  key={index}
                  className="vh-popover-item is-interactive"
                  onClick={() => handleCardClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleCardClick(item);
                    }
                  }}
                >
                  <div className="vh-popover-item-icon">
                    <Icon name="x" />
                  </div>
                  <div className="vh-popover-item-content">
                    <div className="vh-popover-tag-row">
                      <span className="vh-checklist-tag">{item.tag}</span>
                      <span className="vh-checklist-goto-badge">
                        <span>Jump</span>
                        <Icon name="arrowRight" />
                      </span>
                    </div>
                    <p className="vh-popover-item-text">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Status Action Buttons */}
          <div className="vh-popover-actions">
            {module.status === "draft" && (
              <Button
                type="button"
                variant="primary"
                className={`vh-publish-btn ${isReady ? "is-active" : "is-disabled"}`}
                onClick={() => {
                  if (isReady) {
                    onChangeStatus("published");
                    setIsOpen(false);
                  }
                }}
                disabled={busy || !isReady}
              >
                <span>{t.publish}</span>
                <Icon name="arrowRight" />
              </Button>
            )}

            {module.status === "published" && (
              <div className="vh-actions-dual">
                <Button
                  type="button"
                  variant="secondary"
                  className="vh-btn-secondary"
                  onClick={() => {
                    onChangeStatus("draft");
                    setIsOpen(false);
                  }}
                  disabled={busy}
                >
                  {t.returnToDraft}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="vh-btn-danger"
                  onClick={() => {
                    onChangeStatus("archived");
                    setIsOpen(false);
                  }}
                  disabled={busy}
                >
                  {t.archive}
                </Button>
              </div>
            )}

            {module.status === "archived" && (
              <Button
                type="button"
                variant="secondary"
                className="vh-btn-secondary"
                onClick={() => {
                  onChangeStatus("draft");
                  setIsOpen(false);
                }}
                disabled={busy}
              >
                {t.restoreAsDraft}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
