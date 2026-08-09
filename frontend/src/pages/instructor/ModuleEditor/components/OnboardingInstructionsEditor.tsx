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
      <div className="onboarding-toggle-row" style={{ background: "#f8fafc", padding: "16px 20px", borderRadius: 16, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: showInstructions ? "#ecfdf5" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: showInstructions ? "#10b981" : "#94a3b8" }}>
            <Icon name={showInstructions ? "check" : "x"} />
          </div>
          <div>
            <strong style={{ display: "block", fontSize: 14.5, color: "#0f172a" }}>Display Guidelines to Candidates</strong>
            <span style={{ fontSize: 13, color: "#64748b" }}>{showInstructions ? "Guidelines card is active on Step 1 of onboarding wizard" : "Guidelines card is hidden from student onboarding"}</span>
          </div>
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", cursor: isEditable ? "pointer" : "default" }}>
          <input
            type="checkbox"
            checked={showInstructions}
            onChange={(e) => onToggleShowInstructions(e.target.checked)}
            disabled={!isEditable}
            style={{ width: 18, height: 18, accentColor: "#b91c2b", cursor: "pointer" }}
          />
          <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 650, color: "#334155" }}>
            {showInstructions ? "Enabled" : "Disabled"}
          </span>
        </label>
      </div>

      {/* Instructions Items List */}
      {showInstructions && (
        <div className="onboarding-items-editor-list" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {currentItems.map((item, idx) => (
            <div
              key={item.id || idx}
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                padding: 18,
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Item Header Toolbar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: "#b91c2b", background: "rgba(185, 28, 43, 0.08)", padding: "4px 10px", borderRadius: 999 }}>
                  Directive #{idx + 1}
                </span>

                {isEditable && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveItem(idx, -1)}
                      style={{ background: "transparent", border: "none", cursor: idx === 0 ? "not-allowed" : "pointer", opacity: idx === 0 ? 0.3 : 0.75, padding: 4 }}
                      title="Move Up"
                    >
                      <Icon name="chevronDown" style={{ transform: "rotate(180deg)" }} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === currentItems.length - 1}
                      onClick={() => handleMoveItem(idx, 1)}
                      style={{ background: "transparent", border: "none", cursor: idx === currentItems.length - 1 ? "not-allowed" : "pointer", opacity: idx === currentItems.length - 1 ? 0.3 : 0.75, padding: 4 }}
                      title="Move Down"
                    >
                      <Icon name="chevronDown" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(idx)}
                      style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: 4, marginLeft: 6 }}
                      title="Delete Guideline"
                    >
                      <Icon name="trash" />
                    </button>
                  </div>
                )}
              </div>

              {/* Title & Description Fields */}
              <div className="vh-form-group" style={{ margin: 0 }}>
                <input
                  type="text"
                  className="vh-input-enhanced"
                  style={{ fontWeight: 700, fontSize: 14.5 }}
                  value={item.title}
                  onChange={(e) => handleUpdateItem(idx, "title", e.target.value)}
                  placeholder="Guideline Title (e.g. Strict Exam Timer)"
                  readOnly={!isEditable}
                />
              </div>

              <div className="vh-form-group" style={{ margin: 0 }}>
                <textarea
                  className="vh-textarea-enhanced"
                  rows={2}
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
              style={{ marginTop: 8, alignSelf: "flex-start" }}
            >
              Add Custom Guideline
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
