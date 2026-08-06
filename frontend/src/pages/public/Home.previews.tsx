import type { ModuleCard } from "./Home.data";

export function ModuleIcon({ kind }: { kind: ModuleCard["kind"] }) {
  const common = { width: 32, height: 32, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "listening":
      return (
        <svg {...common}>
          <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
          <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
        </svg>
      );
    case "reading":
      return (
        <svg {...common}>
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case "writing":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "speaking":
      return (
        <svg {...common}>
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1={12} y1={19} x2={12} y2={22} />
        </svg>
      );
  }
}

export function WavePreview({ color }: { color: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "0 24px" }}>
      {Array.from({ length: 22 }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 4,
            height: `${20 + Math.sin(i * 0.6) * 40 + 30}%`,
            background: color,
            borderRadius: 2,
            transformOrigin: "center",
            animation: `vh-wave ${0.7 + (i % 5) * 0.15}s ease-in-out ${i * 0.05}s infinite`,
            opacity: 0.75,
          }}
        />
      ))}
    </div>
  );
}

export function ReadingPreview({ color }: { color: string }) {
  const lines = [
    { w: "88%", hi: false },
    { w: "72%", hi: true },
    { w: "94%", hi: false },
    { w: "60%", hi: false },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            height: 8,
            width: l.w,
            borderRadius: 4,
            background: l.hi ? color : "currentColor",
            opacity: l.hi ? 0.85 : 0.18,
            boxShadow: l.hi ? `0 0 20px ${color}66` : "none",
          }}
        />
      ))}
      <div style={{ position: "absolute", left: 22, top: "50%", width: 2, height: 16, background: color, animation: "vh-pulse 0.8s infinite" }} />
    </div>
  );
}

export function WritingPreview({ color }: { color: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--ink2)", textTransform: "uppercase" }}>Task 2 · Essay</div>
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: "var(--ink)" }}>247 / 250</div>
        <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "99%", background: `linear-gradient(90deg, ${color}, ${color}aa)`, borderRadius: 3 }} />
        </div>
      </div>
      <svg width={70} height={70} viewBox="0 0 70 70">
        <circle cx={35} cy={35} r={30} fill="none" stroke="var(--line)" strokeWidth={6} />
        <circle cx={35} cy={35} r={30} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" strokeDasharray={188} strokeDashoffset={40} transform="rotate(-90 35 35)" />
        <text x={35} y={40} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--ink)">
          7.5
        </text>
      </svg>
    </div>
  );
}

export function SpeakingPreview({ color }: { color: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 26px" }}>
      <div
        style={{
          position: "relative",
          width: 66,
          height: 66,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${color}, ${color}88)`,
          display: "grid",
          placeItems: "center",
          boxShadow: `0 0 0 8px ${color}22, 0 0 0 16px ${color}11`,
        }}
      >
        <div style={{ position: "absolute", inset: -8, borderRadius: "50%", border: `2px solid ${color}`, opacity: 0.5, animation: "vh-pulse 1.6s infinite" }} />
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1={12} y1={19} x2={12} y2={22} />
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink2)", letterSpacing: 1, textTransform: "uppercase" }}>Fluency band</div>
        <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -1, color: "var(--ink)" }}>8.0</div>
        <div style={{ display: "flex", gap: 3 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ width: 14, height: 4, borderRadius: 2, background: i < 4 ? color : "var(--line)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ModulePreview({ kind, color }: { kind: ModuleCard["kind"]; color: string }) {
  switch (kind) {
    case "listening":
      return <WavePreview color={color} />;
    case "reading":
      return <ReadingPreview color={color} />;
    case "writing":
      return <WritingPreview color={color} />;
    case "speaking":
      return <SpeakingPreview color={color} />;
  }
}

export function StepIcon({ index }: { index: number }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (index === 0) {
    return (
      <svg {...common}>
        <circle cx={12} cy={13} r={8} />
        <path d="M12 9v4l2 2M12 2v3" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg {...common}>
        <path d="M9 12l2 2 4-4" />
        <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <line x1={18} y1={20} x2={18} y2={10} />
      <line x1={12} y1={20} x2={12} y2={4} />
      <line x1={6} y1={20} x2={6} y2={14} />
    </svg>
  );
}
