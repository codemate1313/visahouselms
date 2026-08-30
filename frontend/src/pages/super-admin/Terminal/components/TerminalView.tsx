import type { RefObject } from "react";
import { confirmAction } from "@/components/confirmDialog";
import { Button } from "@/components/ui/Button/Button";
import { terminalStrings as strings } from "../Terminal.strings";
import type { Preset } from "../types";

interface TerminalViewProps {
  presets: Preset[];
  running: boolean;
  onRunPreset: (preset: Preset) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function TerminalView({ presets, running, onRunPreset, containerRef }: TerminalViewProps) {
  async function handleRunPreset(preset: Preset) {
    const confirmed = await confirmAction(strings.presetConfirm(preset.label), {
      title: strings.presetConfirmTitle,
      confirmText: "Run",
      variant: "warning",
    });
    if (!confirmed) return;
    onRunPreset(preset);
  }

  return (
    <div>
      <h1>{strings.title}</h1>
      <div className="terminal-layout">
        <div className="preset-palette">
          {presets.map((preset) => (
            <Button
              key={preset.name}
              variant="secondary"
              className="preset-btn"
              disabled={running}
              onClick={() => void handleRunPreset(preset)}
              title={preset.description}
            >
              <span className="preset-btn-label">{preset.label}</span>
              {preset.description && <span className="preset-btn-desc">{preset.description}</span>}
            </Button>
          ))}
        </div>
        <div className="terminal-frame" ref={containerRef} />
      </div>
    </div>
  );
}
