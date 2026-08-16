/* oxlint-disable */
import { useState } from "react";
import type { OnboardingInstruction } from "@/api/types";
import { Icon, type IconName } from "@/components/icons";
import { Button, RichTextEditor, renderRichText } from "@/components/ui";

export const DEFAULT_PREFILLED_INSTRUCTIONS: OnboardingInstruction[] = [
  {
    id: "timer_protocol",
    title: "Strict Exam Timer",
    description: "The countdown timer initiates immediately upon clicking 'Commence Assessment'. Responses will auto-submit when the duration expires.",
    icon: "clock",
  },
  {
    id: "sync_protocol",
    title: "Real-Time Response Synchronization",
    description: "Your responses are encrypted and automatically saved every 30 seconds to prevent data loss.",
    icon: "cloud",
  },
  {
    id: "continuity_protocol",
    title: "Session Continuity Protocol",
    description: "In the event of network disruption, you may resume your active session. Note that the official examination clock continues running.",
    icon: "logout",
  },
  {
    id: "matrix_protocol",
    title: "Omni-Directional Question Matrix",
    description: "Use section tabs or the question navigator panel to review, answer, or modify responses freely prior to submission.",
    icon: "restore",
  },
];

interface OnboardingInstructionsEditorProps {
  showInstructions: boolean;
  onToggleShowInstructions: (enabled: boolean) => void;
  instructions: OnboardingInstruction[];
  onInstructionsChange: (instructions: OnboardingInstruction[]) => void;
  isEditable: boolean;
}

const iconColors = ["icon-blue", "icon-green", "icon-amber", "icon-purple", "icon-cyan"];

const SELECTABLE_INSTRUCTION_ICONS: Array<{ name: IconName; label: string }> = [
  { name: "clock", label: "Timer" },
  { name: "cloud", label: "Sync" },
  { name: "logout", label: "Session" },
  { name: "restore", label: "Matrix" },
  { name: "lock", label: "Security" },
  { name: "check", label: "Rules" },
  { name: "volume", label: "Audio" },
  { name: "microphone", label: "Speaking" },
  { name: "eye", label: "Review" },
  { name: "help", label: "Help" },
  { name: "courses", label: "Structure" },
  { name: "edit", label: "Notes" },
  { name: "module", label: "Sections" },
  { name: "analytics", label: "Scoring" },
  { name: "user", label: "Candidate" },
  { name: "pin", label: "Bookmark" },
  { name: "filePdf", label: "Document" },
  { name: "notifications", label: "Alerts" },
  { name: "globe", label: "Online" },
  { name: "history", label: "Attempts" },
  { name: "play", label: "Media" },
  { name: "settings", label: "Hardware" },
];

export function OnboardingInstructionsEditor({
  showInstructions,
  onToggleShowInstructions,
  instructions,
  onInstructionsChange,
  isEditable,
}: OnboardingInstructionsEditorProps) {
  const currentItems = instructions && instructions.length > 0 ? instructions : DEFAULT_PREFILLED_INSTRUCTIONS;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleUpdateItem = (index: number, key: "title" | "description" | "icon", value: string) => {
    if (!isEditable) return;
    const next = [...currentItems];
    next[index] = { ...next[index], [key]: value };
    onInstructionsChange(next);
  };

  const handleAddItem = () => {
    if (!isEditable) return;
    const newItem: OnboardingInstruction = {
      id: `custom_${Date.now()}`,
      title: "New Directive / Guideline",
      description: "Enter official instruction details for candidates here.",
      icon: "edit",
    };
    const next = [...currentItems, newItem];
    onInstructionsChange(next);
    setEditingIndex(next.length - 1);
  };

  const handleDeleteItem = (index: number) => {
    if (!isEditable) return;
    const next = currentItems.filter((_, i) => i !== index);
    onInstructionsChange(next);
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  const handleMoveItem = (index: number, direction: -1 | 1) => {
    if (!isEditable) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentItems.length) return;
    const next = [...currentItems];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onInstructionsChange(next);
    if (editingIndex === index) {
      setEditingIndex(targetIndex);
    }
  };

  const handleResetDefaults = () => {
    if (!isEditable) return;
    onInstructionsChange(DEFAULT_PREFILLED_INSTRUCTIONS);
    setEditingIndex(null);
  };

  return (
    <div className="vh-studio-card">
      {/* Header with Toggle & Actions */}
      <div className="vh-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2>Candidate Pre-Exam Guidelines (Student Preview)</h2>
          <p>Preview of guidelines displayed to students before starting. Click Edit to customize any item.</p>
        </div>

        {isEditable && (
          <Button variant="ghost" size="sm" onClick={handleResetDefaults} leftIcon={<Icon name="restore" />}>
            Reset to Standard Defaults
          </Button>
        )}
      </div>

      {/* Main Visibility Switch Toggle */}
      <div className="onboarding-toggle-row">
        <div className="onboarding-toggle-info">
          <span className={`onboarding-toggle-icon ${showInstructions ? "is-on" : "is-off"}`}>
            <Icon name={showInstructions ? "check" : "x"} />
          </span>
          <span className="onboarding-toggle-text">
            <strong>Display Guidelines to Candidates</strong>
            <span>
              {showInstructions
                ? "Guidelines card is active on Step 1 of student onboarding wizard"
                : "Guidelines card is hidden from student onboarding"}
            </span>
          </span>
        </div>

        <label className="onboarding-toggle-switch" data-disabled={!isEditable}>
          <input
            type="checkbox"
            checked={showInstructions}
            onChange={(e) => onToggleShowInstructions(e.target.checked)}
            disabled={!isEditable}
          />
          <span>{showInstructions ? "Enabled" : "Disabled"}</span>
        </label>
      </div>

      {/* Instructions Items List - Live Student Preview with Inline Edit */}
      {showInstructions && (
        <div className="onboarding-items-editor-list" style={{ marginTop: "16px" }}>
          {currentItems.map((item, idx) => {
            const isEditing = editingIndex === idx;
            const colorClass = iconColors[idx % iconColors.length];

            if (isEditing) {
              return (
                <div className="onboarding-directive is-editing-mode" key={item.id || idx}>
                  <div className="onboarding-directive-head">
                    <span className="onboarding-directive-badge">Editing Directive #{idx + 1}</span>

                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setEditingIndex(null)}
                        leftIcon={<Icon name="check" />}
                      >
                        Done
                      </Button>
                      <button
                        type="button"
                        className="onboarding-tool-btn is-danger"
                        onClick={() => handleDeleteItem(idx)}
                        title="Delete guideline"
                        aria-label={`Delete directive ${idx + 1}`}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>

                  {/* Title Field */}
                  <div className="vh-form-group" style={{ marginBottom: "10px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Guideline Title
                    </label>
                    <input
                      type="text"
                      className="vh-input-enhanced onboarding-directive-title"
                      value={item.title}
                      onChange={(e) => handleUpdateItem(idx, "title", e.target.value)}
                      placeholder="Guideline title (e.g. Strict Exam Timer)"
                      autoFocus
                    />
                  </div>

                  {/* Icon Picker Field */}
                  <div className="vh-form-group" style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "6px" }}>
                      Choose Directive Icon
                    </label>
                    <div className="vh-icon-picker-list">
                      {SELECTABLE_INSTRUCTION_ICONS.map((ic) => {
                        const isSelected = (item.icon || "check") === ic.name;
                        return (
                          <button
                            key={ic.name}
                            type="button"
                            className={`vh-icon-picker-pill ${isSelected ? "is-selected" : ""}`}
                            onClick={() => handleUpdateItem(idx, "icon", ic.name)}
                            title={`Select ${ic.label} icon`}
                          >
                            <Icon name={ic.name} />
                            <span>{ic.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Description Field */}
                  <div className="vh-form-group" style={{ marginBottom: "6px" }}>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                      Guideline Instructions & Details
                    </label>
                    <RichTextEditor
                      className="vh-textarea-enhanced onboarding-directive-body"
                      rows={3}
                      value={item.description}
                      onChange={(next) => handleUpdateItem(idx, "description", next)}
                      placeholder="Enter detailed instruction for candidates..."
                      aria-label="Guideline description"
                    />
                  </div>
                </div>
              );
            }

            return (
              <div className="vh-instruction-preview-item" key={item.id || idx}>
                <div className="vh-instruction-student-view">
                  <div className={`rule-icon-box ${colorClass}`}>
                    <Icon name={(item.icon as any) || "check"} />
                  </div>
                  <div className="rule-text">
                    <strong>{item.title}.</strong> {renderRichText(item.description)}
                  </div>
                </div>

                {isEditable && (
                  <div className="vh-instruction-preview-actions">
                    <button
                      type="button"
                      className="vh-instruction-edit-btn"
                      onClick={() => setEditingIndex(idx)}
                      title="Edit this guideline"
                    >
                      <Icon name="edit" />
                      <span>Edit</span>
                    </button>

                    <div className="onboarding-directive-tools">
                      <button
                        type="button"
                        className="onboarding-tool-btn"
                        disabled={idx === 0}
                        onClick={() => handleMoveItem(idx, -1)}
                        title="Move up"
                        aria-label={`Move directive ${idx + 1} up`}
                      >
                        <Icon name="chevronDown" style={{ transform: "rotate(180deg)" }} />
                      </button>
                      <button
                        type="button"
                        className="onboarding-tool-btn"
                        disabled={idx === currentItems.length - 1}
                        onClick={() => handleMoveItem(idx, 1)}
                        title="Move down"
                        aria-label={`Move directive ${idx + 1} down`}
                      >
                        <Icon name="chevronDown" />
                      </button>
                      <button
                        type="button"
                        className="onboarding-tool-btn is-danger"
                        onClick={() => handleDeleteItem(idx)}
                        title="Delete guideline"
                        aria-label={`Delete directive ${idx + 1}`}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Custom Item Action */}
          {isEditable && (
            <div style={{ marginTop: "12px" }}>
              <Button
                variant="secondary"
                onClick={handleAddItem}
                leftIcon={<Icon name="plus" />}
                className="onboarding-add-directive"
              >
                Add Custom Guideline
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
