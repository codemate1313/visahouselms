interface SparklineProps {
  theme: "green" | "blue" | "amber" | "purple" | "slate";
}

export function Sparkline({ theme }: SparklineProps) {
  const colorMap = {
    green: { stroke: "var(--emerald-500)", id: "spark-grad-green" },
    blue: { stroke: "var(--blue-500)", id: "spark-grad-blue" },
    amber: { stroke: "var(--amber-500)", id: "spark-grad-amber" },
    purple: { stroke: "var(--shade-8b5cf6)", id: "spark-grad-purple" },
    slate: { stroke: "var(--slate-500)", id: "spark-grad-slate" },
  };

  const { stroke, id } = colorMap[theme] || colorMap.green;

  return (
    <svg width="72" height="30" viewBox="0 0 72 30" fill="none" className="metric-sparkline">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d="M 2 22 Q 14 16, 26 20 T 50 12 T 70 4 L 70 30 L 2 30 Z" fill={`url(#${id})`} />
      <path d="M 2 22 Q 14 16, 26 20 T 50 12 T 70 4" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
