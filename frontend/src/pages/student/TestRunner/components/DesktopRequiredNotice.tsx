import { testRunnerStrings as strings } from "../TestRunner.strings";
import { Button } from "@/components/ui/Button/Button";

interface DesktopRequiredNoticeProps {
  onBackToDashboard: () => void;
}

export function DesktopRequiredNotice({ onBackToDashboard }: DesktopRequiredNoticeProps) {
  const t = strings.desktopRequired;
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--background, var(--slate-900))",
      color: "var(--text, var(--white))",
      padding: "24px",
      textAlign: "center",
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      <div style={{
        maxWidth: "440px",
        background: "var(--surface, #1e293b)",
        padding: "40px 32px",
        borderRadius: "24px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
        border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}>
        {/* Monitor/Computer Icon */}
        <div style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          background: "color-mix(in srgb, var(--primary, var(--red-500)) 15%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px"
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #e11d2e)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>

        <h2 style={{
          fontSize: "24px",
          fontWeight: "800",
          marginBottom: "12px"
        }}>{t.heading}</h2>

        <p style={{
          fontSize: "15px",
          lineHeight: "1.6",
          color: "var(--text-secondary, var(--slate-400))",
          marginBottom: "32px"
        }}>
          {t.description}
        </p>

        <Button
          onClick={onBackToDashboard}
          style={{
            width: "100%",
            padding: "14px 28px",
            borderRadius: "12px",
            background: "var(--primary, var(--red-500))",
            color: "var(--white)",
            fontSize: "15px",
            fontWeight: "600",
            border: "none",
            cursor: "pointer",
            transition: "transform 0.2s, filter 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.filter = "brightness(1.15)"}
          onMouseOut={(e) => e.currentTarget.style.filter = "none"}
        >
          {t.backToDashboard}
        </Button>
      </div>
    </div>
  );
}
