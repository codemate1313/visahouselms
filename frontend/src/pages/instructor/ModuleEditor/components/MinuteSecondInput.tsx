import { useEffect, useRef, useState } from "react";
import { RequiredMark } from "@/components/ui";

interface MinuteSecondInputProps {
  id: string;
  label: string;
  value: number;
  minSeconds: number;
  maxSeconds: number;
  onChange: (totalSeconds: number) => void;
  readOnly?: boolean;
  required?: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function MinuteSecondInput({
  id,
  label,
  value,
  minSeconds,
  maxSeconds,
  onChange,
  readOnly = false,
  required = false,
}: MinuteSecondInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSeconds = clamp(Math.round(Number(value) || 0), minSeconds, maxSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const maxMinutes = Math.floor(maxSeconds / 60);

  // Close popup on click outside
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

  const setTime = (m: number, s: number) => {
    onChange(clamp(m * 60 + s, minSeconds, maxSeconds));
  };

  const presets = [
    { label: "0s", m: 0, s: 0 },
    { label: "15s", m: 0, s: 15 },
    { label: "30s", m: 0, s: 30 },
    { label: "45s", m: 0, s: 45 },
    { label: "1m", m: 1, s: 0 },
    { label: "2m", m: 2, s: 0 },
  ].filter(p => {
    const secs = p.m * 60 + p.s;
    return secs >= minSeconds && secs <= maxSeconds;
  });

  return (
    <div className="vh-timepicker-container" ref={containerRef} style={{ position: "relative", minWidth: 0, flex: 1 }}>
      <label
        className="vh-timepicker-label"
        htmlFor={`${id}-btn`}
        style={{
          display: "block",
          margin: "0 0 8px",
          color: "var(--text, #0f172a)",
          fontSize: "14px",
          fontWeight: 700,
        }}
      >
        {label}
        {required && <RequiredMark />}
      </label>

      <button
        id={`${id}-btn`}
        type="button"
        className="vh-timepicker-trigger"
        onClick={() => !readOnly && setIsOpen(!isOpen)}
        disabled={readOnly}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "11px 14px",
          background: "var(--surface, #ffffff)",
          border: "1px solid var(--border, #cbd5e1)",
          borderRadius: "12px",
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--text, #0f172a)",
          cursor: readOnly ? "not-allowed" : "pointer",
          textAlign: "left",
          transition: "all 0.2s",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
          outline: "none",
        }}
      >
        <span>
          {String(minutes).padStart(2, "0")}m : {String(seconds).padStart(2, "0")}s
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginLeft: "8px",
            color: "var(--text-muted, #64748b)",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="vh-timepicker-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 999,
            width: "280px",
            marginTop: "6px",
            background: "var(--surface, #ffffff)",
            border: "1px solid var(--border, #cbd5e1)",
            borderRadius: "16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {/* Quick Presets */}
          {presets.length > 0 && (
            <div className="vh-timepicker-presets" style={{ display: "flex", gap: "6px", flexWrap: "wrap", borderBottom: "1px solid var(--border-light, #f1f5f9)", paddingBottom: "10px" }}>
              {presets.map(p => {
                const isActive = minutes === p.m && seconds === p.s;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setTime(p.m, p.s);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: isActive ? "1px solid var(--primary, #b91c2b)" : "1px solid var(--border, #cbd5e1)",
                      background: isActive ? "rgba(185, 28, 43, 0.1)" : "transparent",
                      color: isActive ? "var(--primary, #b91c2b)" : "var(--text-muted, #475569)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Time Picker Columns */}
          <div className="vh-timepicker-columns" style={{ display: "flex", gap: "12px", height: "180px" }}>
            {/* Minutes Column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted, #64748b)", marginBottom: "4px", textAlign: "center" }}>Min</span>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  border: "1px solid var(--border-light, #f1f5f9)",
                  borderRadius: "8px",
                  padding: "4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                {Array.from({ length: maxMinutes + 1 }).map((_, m) => {
                  const isActive = minutes === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setTime(m, seconds)}
                      style={{
                        padding: "6px 0",
                        width: "100%",
                        textAlign: "center",
                        borderRadius: "6px",
                        border: "none",
                        background: isActive ? "var(--primary, #b91c2b)" : "transparent",
                        color: isActive ? "#ffffff" : "var(--text, #0f172a)",
                        fontSize: "13px",
                        fontWeight: isActive ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.1s",
                      }}
                    >
                      {String(m).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seconds Column */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted, #64748b)", marginBottom: "4px", textAlign: "center" }}>Sec</span>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  border: "1px solid var(--border-light, #f1f5f9)",
                  borderRadius: "8px",
                  padding: "4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                {Array.from({ length: 60 }).map((_, s) => {
                  const isActive = seconds === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTime(minutes, s)}
                      style={{
                        padding: "6px 0",
                        width: "100%",
                        textAlign: "center",
                        borderRadius: "6px",
                        border: "none",
                        background: isActive ? "var(--primary, #b91c2b)" : "transparent",
                        color: isActive ? "#ffffff" : "var(--text, #0f172a)",
                        fontSize: "13px",
                        fontWeight: isActive ? 700 : 500,
                        cursor: "pointer",
                        transition: "all 0.1s",
                      }}
                    >
                      {String(s).padStart(2, "0")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
