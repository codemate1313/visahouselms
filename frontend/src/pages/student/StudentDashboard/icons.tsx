import type { ReactNode } from "react";

function StatSvg({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const STAT_ICONS: Record<string, ReactNode> = {
  available: (
    <StatSvg>
      <rect x="5" y="4" width="14" height="17" rx="2.4" />
      <path d="M9 3.4h6a.6.6 0 0 1 .6.6v1.4H8.4V4a.6.6 0 0 1 .6-.6Z" />
      <path d="M9 11h6M9 15h4" />
    </StatSvg>
  ),
  completed: (
    <StatSvg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.4 12.3l2.4 2.4 4.8-4.8" />
    </StatSvg>
  ),
  pending: (
    <StatSvg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </StatSvg>
  ),
  in_progress: (
    <StatSvg>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 8.3l5 3.7-5 3.7V8.3Z" />
    </StatSvg>
  ),
  awaiting: (
    <StatSvg>
      <path d="M6 20.5V4" />
      <path d="M6 4.5h11l-2.6 3.6L17 11.5H6" />
    </StatSvg>
  ),
  graded: (
    <StatSvg>
      <circle cx="12" cy="8.5" r="4.7" />
      <path d="M9 12.7L7.2 20l4.8-2.8 4.8 2.8-1.8-7.3" />
    </StatSvg>
  ),
};
