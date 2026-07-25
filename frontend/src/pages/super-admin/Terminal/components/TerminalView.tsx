import type { RefObject } from "react";
import { terminalStrings as strings } from "../Terminal.strings";
import type { Preset } from "../types";

interface TerminalViewProps {
  presets: Preset[];
  running: boolean;
  onRunPreset: (preset: Preset) => void;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function TerminalView({ presets, running, onRunPreset, containerRef }: TerminalViewProps) {
  return (
    <div>
      <h1>{strings.title}</h1>
      <div className="terminal-layout">
        <div className="preset-palette">
          {presets.map((preset) => (
            <button key={preset.name} disabled={running} onClick={() => onRunPreset(preset)} title={preset.description}>
              {preset.label}
            </button>
          ))}
        </div>
        <div className="terminal-frame" ref={containerRef} />
      </div>
    </div>
  );
}
