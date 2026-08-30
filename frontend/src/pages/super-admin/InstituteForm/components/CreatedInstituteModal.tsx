import { createPortal } from "react-dom";
import { instituteFormStrings as strings } from "../InstituteForm.strings";
import type { CreatedInstitute } from "../types";
import { Button } from "@/components/ui";

interface CreatedInstituteModalProps {
  created: CreatedInstitute;
  copied: boolean;
  onCopyPassword: () => void;
  onDone: () => void;
}

export function CreatedInstituteModal({ created, copied, onCopyPassword, onDone }: CreatedInstituteModalProps) {
  const t = strings.createdModal;
  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,

        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(500px, 94vw)",
          padding: "28px",
          borderRadius: "16px",
          background: "var(--surface, var(--white))",
          border: "1px solid var(--border, var(--border))",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.3)",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 6px", color: "var(--text, var(--slate-900))" }}>{t.heading}</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted, var(--slate-500))", margin: "0 0 20px", lineHeight: "1.5" }}>{t.description}</p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            marginBottom: 24,
            padding: 16,
            borderRadius: 12,
            background: "var(--surface-muted, #f8fafc)",
            border: "1px solid var(--border, var(--border))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted, var(--slate-500))" }}>{t.email}</span>
            <code style={{ fontSize: 13, fontWeight: 600, color: "var(--text, var(--slate-900))", background: "rgba(0, 0, 0, 0.05)", padding: "4px 10px", borderRadius: 6, fontFamily: "monospace" }}>
              {created.admin_email}
            </code>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted, var(--slate-500))" }}>{t.temporaryPassword}</span>
            <code
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--primary, var(--red-500))",
                background: "rgba(225, 29, 46, 0.08)",
                padding: "6px 12px",
                borderRadius: 6,
                fontFamily: "monospace",
                border: "1px solid rgba(225, 29, 46, 0.2)",
                letterSpacing: "0.04em",
              }}
            >
              {created.admin_temp_password || "Password Saved"}
            </code>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="secondary" size="sm" onClick={onCopyPassword}>
            {copied ? t.copied : t.copyPassword}
          </Button>
          <Button type="button" className="primary-submit-btn" onClick={onDone} style={{ padding: "8px 20px", fontSize: 13 }}>
            {t.done}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
