import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { loginStrings as strings } from "../Login.strings";

interface ForgotPasswordModalProps {
  email: string;
  onEmailChange: (value: string) => void;
  sent: boolean;
  loading: boolean;
  error: string | null;
  onSubmit: (event: FormEvent) => void;
  onClose: () => void;
  onDone: () => void;
}

export function ForgotPasswordModal({ email, onEmailChange, sent, loading, error, onSubmit, onClose, onDone }: ForgotPasswordModalProps) {
  const t = strings.forgotModal;
  
  const modalContent = (
    <div 
      onClick={onClose} 
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.3)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
        animation: 'modalFadeIn 0.25s ease-out'
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes modalSpin { 100% { transform: rotate(360deg); } }
        .premium-input::placeholder { color: #94a3b8; }
      ` }} />

      <div 
        onClick={(e) => e.stopPropagation()} 
        role="dialog" 
        style={{ 
          width: '100%',
          maxWidth: 440,
          backgroundColor: "var(--surface)",
          borderRadius: 16,
          boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          animation: 'modalSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative'
        }}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: "var(--text-muted)",
            transition: 'all 0.2s',
            zIndex: 10
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "var(--surface-muted)"; e.currentTarget.style.color = "var(--text)"; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div style={{ padding: '48px 40px 40px' }}>
          {sent ? (
            <div style={{ textAlign: "center", animation: 'modalFadeIn 0.4s ease-out' }}>
              <div style={{ 
                width: 64, height: 64, borderRadius: '50%', backgroundColor: '#dcfce7', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                boxShadow: '0 0 0 8px #f0fdf4'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <h2 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 800, color: "var(--text)", letterSpacing: '-0.02em' }}>Email Sent</h2>
              <p style={{ margin: '0 0 32px', fontSize: 15, color: "var(--text-muted)", lineHeight: 1.6 }}>
                {t.sentMessage}
              </p>
              <button 
                type="button" 
                onClick={onDone}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {t.doneLabel}
              </button>
            </div>
          ) : (
            <>
              <div style={{ 
                width: 56, height: 56, borderRadius: '12px', backgroundColor: '#fff1f2', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
                border: '1px solid #ffe4e6',
                boxShadow: '0 2px 10px rgba(225, 29, 72, 0.1)'
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              
              <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: "var(--text)", letterSpacing: '-0.02em' }}>{t.title}</h2>
              <p style={{ margin: '0 0 32px', fontSize: 15, color: "var(--text-muted)", lineHeight: 1.6 }}>{t.description}</p>
              
              <form onSubmit={onSubmit}>
                <div style={{ marginBottom: 24 }}>
                  <label htmlFor="forgot-email" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {t.emailLabel} <span style={{ color: '#e11d48' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 0, bottom: 0, left: 16, display: 'flex', alignItems: 'center', pointerEvents: 'none', color: "var(--text-muted)" }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                    </div>
                    <input 
                      id="forgot-email" 
                      className="premium-input"
                      type="email" 
                      placeholder="name@example.com" 
                      value={email} 
                      onChange={(e) => onEmailChange(e.target.value)} 
                      required 
                      style={{
                        width: '100%',
                        padding: '14px 16px 14px 44px',
                        fontSize: 15,
                        color: "var(--text)",
                        backgroundColor: "var(--surface-muted)",
                        border: '1px solid var(--border)',
                        borderRadius: 12,
                        outline: 'none',
                        transition: 'all 0.2s',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#e11d48';
                        e.currentTarget.style.backgroundColor = "var(--surface)";
                        e.currentTarget.style.boxShadow = '0 0 0 4px rgba(225, 29, 72, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.backgroundColor = "var(--surface-muted)";
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>
                
                {error && (
                  <div style={{ 
                    marginBottom: 24, padding: '12px 16px', backgroundColor: '#fef2f2', 
                    borderLeft: '4px solid #e11d48', borderRadius: '0 8px 8px 0',
                    color: '#9f1239', fontSize: 14, display: 'flex', alignItems: 'flex-start', gap: 10
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <div style={{ lineHeight: 1.4 }}>{error}</div>
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={loading || !email}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    backgroundColor: '#e11d48',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: loading || !email ? 'not-allowed' : 'pointer',
                    opacity: loading || !email ? 0.6 : 1,
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    boxShadow: loading || !email ? 'none' : '0 4px 14px rgba(225, 29, 72, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    if (!loading && email) {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(225, 29, 72, 0.4)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!loading && email) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(225, 29, 72, 0.3)';
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'modalSpin 1s linear infinite' }}>
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                      </svg>
                      {t.sendBusy}
                    </>
                  ) : (
                    <>
                      {t.sendLabel}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
  
  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
