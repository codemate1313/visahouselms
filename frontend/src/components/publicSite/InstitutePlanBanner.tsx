import type { PublicTheme } from "./authOverlayTypes";

interface InstitutePlanBannerProps {
  publicTheme: PublicTheme;
  onClose: () => void;
  onGoToCourses: () => void;
}

export function InstitutePlanBanner({ publicTheme, onClose, onGoToCourses }: InstitutePlanBannerProps) {
  const dark = publicTheme === "dark";

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    background: dark ? "rgba(0,0,0,0.72)" : "rgba(0,0,0,0.45)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    animation: "vhFadeIn 0.18s ease",
  };

  const cardStyle: React.CSSProperties = {
    position: "relative",
    width: "100%",
    maxWidth: "440px",
    borderRadius: "20px",
    padding: "40px 36px 32px",
    background: dark ? "#18181f" : "var(--white)",
    border: dark ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(14,13,16,0.08)",
    boxShadow: dark
      ? "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)"
      : "0 24px 60px rgba(0,0,0,0.18)",
    animation: "vhSlideUp 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
  };

  const iconWrapStyle: React.CSSProperties = {
    width: "60px",
    height: "60px",
    borderRadius: "16px",
    background: "rgba(225,29,46,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
    fontSize: "28px",
  };

  const titleStyle: React.CSSProperties = {
    margin: "0 0 10px",
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: 1.3,
    color: dark ? "#f5f5f7" : "#0e0d10",
    fontFamily: "Inter, system-ui, sans-serif",
  };

  const bodyStyle: React.CSSProperties = {
    margin: "0 0 28px",
    fontSize: "14.5px",
    lineHeight: 1.65,
    color: dark ? "#9095a3" : "#5f6270",
    fontFamily: "Inter, system-ui, sans-serif",
  };

  const primaryBtnStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "13px 20px",
    borderRadius: "12px",
    border: "none",
    cursor: "pointer",
    background: "linear-gradient(135deg, var(--red-500), var(--red-600-alt))",
    color: "var(--white)",
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "0.01em",
    fontFamily: "Inter, system-ui, sans-serif",
    boxShadow: "0 4px 16px rgba(225,29,46,0.35)",
    transition: "opacity 0.15s, transform 0.15s",
    marginBottom: "12px",
  };

  const secondaryBtnStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "13px 20px",
    borderRadius: "12px",
    border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(14,13,16,0.12)",
    cursor: "pointer",
    background: "transparent",
    color: dark ? "#9095a3" : "#5f6270",
    fontSize: "14px",
    fontWeight: 500,
    fontFamily: "Inter, system-ui, sans-serif",
    transition: "background 0.15s",
  };

  const closeBtnStyle: React.CSSProperties = {
    position: "absolute",
    top: "16px",
    right: "16px",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    border: "none",
    background: dark ? "rgba(255,255,255,0.07)" : "rgba(14,13,16,0.06)",
    color: dark ? "#9095a3" : "#5f6270",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    lineHeight: 1,
    fontFamily: "monospace",
  };

  return (
    <>
      <style>{`
        @keyframes vhFadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes vhSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.97) } to { opacity: 1; transform: none } }
        .vh-inst-primary:hover { opacity: 0.88; transform: translateY(-1px); }
        .vh-inst-secondary:hover { background: ${dark ? "rgba(255,255,255,0.05)" : "rgba(14,13,16,0.04)"}; }
      `}</style>
      <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true" aria-label="Institute plan notice">
        <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
          <button style={closeBtnStyle} onClick={onClose} aria-label="Close">×</button>

          <div style={iconWrapStyle}>🏫</div>

          <h2 style={titleStyle}>You're on an Institute Plan</h2>
          <p style={bodyStyle}>
            Your account is part of an institute — your course access is managed by your
            institution's admin. Individual plan purchases are available to{" "}
            <strong style={{ color: dark ? "#e5e7eb" : "#111" }}>direct student accounts</strong> only.
            <br /><br />
            Head to your courses to see what's already available to you, or contact your institute
            admin to request access to more content.
          </p>

          <button className="vh-inst-primary" style={primaryBtnStyle} onClick={onGoToCourses}>
            Go to My Courses
          </button>
          <button className="vh-inst-secondary" style={secondaryBtnStyle} onClick={onClose}>
            Stay on this page
          </button>
        </div>
      </div>
    </>
  );
}
