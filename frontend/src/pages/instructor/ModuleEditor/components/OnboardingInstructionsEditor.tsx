/* oxlint-disable */
import type { OnboardingInstruction } from "@/api/types";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";

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

export function OnboardingInstructionsEditor({
  showInstructions,
  onToggleShowInstructions,
  instructions,
  onInstructionsChange,
  isEditable,
}: OnboardingInstructionsEditorProps) {
  const currentItems = instructions && instructions.length > 0 ? instructions : DEFAULT_PREFILLED_INSTRUCTIONS;

  const handleUpdateItem = (index: number, key: "title" | "description", value: string) => {
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
    onInstructionsChange([...currentItems, newItem]);
  };

  const handleDeleteItem = (index: number) => {
    if (!isEditable) return;
    const next = currentItems.filter((_, i) => i !== index);
    onInstructionsChange(next);
  };

  const handleMoveItem = (index: number, direction: -1 | 1) => {
    if (!isEditable) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentItems.length) return;
    const next = [...currentItems];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onInstructionsChange(next);
  };

  const handleResetDefaults = () => {
    if (!isEditable) return;
    onInstructionsChange(DEFAULT_PREFILLED_INSTRUCTIONS);
  };

  return (
    <div className="vh-studio-card" style={{ marginTop: 20 }}>
      {/* Header with Toggle & Actions */}
      <div className="vh-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2>Candidate Pre-Exam Guidelines Manager</h2>
          <p>Configure, customize, or prefill the integrity directives displayed to candidates before commencing.</p>
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
                ? "Guidelines card is active on Step 1 of onboarding wizard"
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

      {/* Instructions Items List */}
      {showInstructions && (
        <div className="onboarding-items-editor-list">
          {currentItems.map((item, idx) => (
            <div className="onboarding-directive" key={item.id || idx}>
              {/* Item Header Toolbar */}
              <div className="onboarding-directive-head">
                <span className="onboarding-directive-badge">Directive #{idx + 1}</span>

                {isEditable && (
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
                )}
              </div>

              {/* Title & Description Fields */}
              <div className="vh-form-group">
                <input
                  type="text"
                  className="vh-input-enhanced onboarding-directive-title"
                  value={item.title}
                  onChange={(e) => handleUpdateItem(idx, "title", e.target.value)}
                  placeholder="Guideline title (e.g. Strict Exam Timer)"
                  readOnly={!isEditable}
                />
              </div>

              <div className="vh-form-group">
                <textarea
                  className="vh-textarea-enhanced onboarding-directive-body"
                  rows={3}
                  value={item.description}
                  onChange={(e) => handleUpdateItem(idx, "description", e.target.value)}
                  placeholder="Enter detailed instruction for candidates..."
                  readOnly={!isEditable}
                />
              </div>
            </div>
          ))}

          {/* Add Custom Item Action */}
          {isEditable && (
            <Button
              variant="secondary"
              onClick={handleAddItem}
              leftIcon={<Icon name="plus" />}
              className="onboarding-add-directive"
            >
              Add Custom Guideline
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
