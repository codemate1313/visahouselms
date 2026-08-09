import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { PortalSupportTicket, SupportTicketMessage, SupportTicketPriority, SupportTicketStatus } from "@/api/types";
import { Icon } from "@/components/icons";
import {
  Badge,
  type BadgeTone,
  Button,
  Input,
  Modal,
  PageHeader,
  SearchableSelect,
  Textarea,
} from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import { supportCenterStrings as strings } from "./SupportCenter.strings";
import "./SupportCenter.css";

const CATEGORY_OPTIONS = Object.entries(strings.categories).map(([value, label]) => ({ value, label }));

function label(value: string) {
  if (value === "new") return "Unread";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: SupportTicketStatus): BadgeTone {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "open") return "info";
  return "warning";
}

function priorityTone(priority: SupportTicketPriority): BadgeTone {
  if (priority === "high") return "danger";
  if (priority === "low") return "neutral";
  return "info";
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SupportCenter() {
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<PortalSupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [readTicketIds, setReadTicketIds] = useState<Set<number>>(() => new Set());

  const [category, setCategory] = useState(() => searchParams.get("category") || "general");
  const [subject, setSubject] = useState(() => searchParams.get("subject") || "");
  const [message, setMessage] = useState("");
  const [replyText, setReplyText] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const role = useAuthStore((state) => state.user?.role);
  const usesInstituteSupport = role === "STUDENT" || role === "INST_INSTRUCTOR";

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null,
    [selectedId, tickets]
  );

  useEffect(() => {
    if (isChatOpen && selectedId) {
      setReadTicketIds((prev) => {
        if (prev.has(selectedId)) return prev;
        const next = new Set(prev);
        next.add(selectedId);
        return next;
      });
    }
  }, [isChatOpen, selectedId]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<PortalSupportTicket[]>("/support/my-tickets");
      setTickets(data);
      setError(null);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.load));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (chatStreamRef.current) {
      chatStreamRef.current.scrollTop = chatStreamRef.current.scrollHeight;
    }
  }, [selectedTicket?.messages, selectedTicket?.id, isChatOpen]);

  async function handleCloseTicket() {
    if (!selectedTicket) return;
    setSaving(true);
    setError(null);
    try {
      const { data: updatedTicket } = await apiClient.post<PortalSupportTicket>(
        `/support/my-tickets/${selectedTicket.id}/close`
      );
      showSuccess("Support ticket closed successfully", "Ticket Closed");
      if (updatedTicket) {
        setTickets((prev) =>
          prev.map((t) => (t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t))
        );
      }
      await loadTickets();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to close support ticket"));
    } finally {
      setSaving(false);
    }
  }

  async function submitTicket(event: FormEvent) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await apiClient.post<{ id: number }>("/support/my-tickets", {
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setCategory("general");
      setSubject("");
      setMessage("");
      setIsCreateOpen(false);
      showSuccess(strings.success, "Query Submitted");
      await loadTickets();
      if (data?.id) {
        setSelectedId(data.id);
        setIsChatOpen(true);
      }
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.submit));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendMessage(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    setSendingMessage(true);
    setError(null);
    try {
      const { data: updatedTicket } = await apiClient.post<PortalSupportTicket>(
        `/support/my-tickets/${selectedTicket.id}/messages`,
        { message: replyText.trim() }
      );
      setReplyText("");
      showSuccess("Message sent successfully", "Message Sent");
      if (updatedTicket && updatedTicket.messages) {
        setTickets((prev) =>
          prev.map((t) => (t.id === updatedTicket.id ? { ...t, ...updatedTicket } : t))
        );
      }
      await loadTickets();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to send message"));
    } finally {
      setSendingMessage(false);
    }
  }

  return (
    <div className="support-center-page">
      <PageHeader
        appearance="compact"
        eyebrow={strings.eyebrow}
        title={strings.title}
        subtitle={usesInstituteSupport ? strings.instituteSubtitle : strings.subtitle}
        actions={
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Button
              variant="primary"
              leftIcon={<Icon name="plus" />}
              onClick={() => setIsCreateOpen(true)}
            >
              Raise a Query
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Icon name="notifications" />}
              onClick={() => void loadTickets()}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {error && <p className="error-text notice-line">{error}</p>}

      {/* Main Full-Width Table Workspace */}
      <div className="support-ticket-workspace" style={{ width: "100%", marginTop: "16px" }}>
        <div className="support-ticket-table-card" style={{ width: "100%" }}>
          <table className="data-table institute-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: "360px", minWidth: "320px" }}>{strings.table?.enquiry ?? "Enquiry"}</th>
                <th style={{ minWidth: "150px" }}>Routing</th>
                <th style={{ width: "110px", minWidth: "100px" }}>{strings.table?.status ?? "Status"}</th>
                <th style={{ width: "100px", minWidth: "90px" }}>Priority</th>
                <th style={{ width: "170px", minWidth: "150px" }}>Submitted On</th>
                <th className="table-actions-heading" style={{ width: "80px", minWidth: "75px" }}>{strings.table?.actions ?? "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty-cell">{strings.history.loading}</td>
                </tr>
              ) : !tickets.length ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    <div style={{ padding: "32px", textAlign: "center" }}>
                      <h3 style={{ margin: "0 0 6px 0", fontSize: "1.1rem" }}>{strings.history.emptyTitle}</h3>
                      <p style={{ margin: "0 0 16px 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                        {strings.history.emptyDescription}
                      </p>
                      <Button
                        variant="primary"
                        leftIcon={<Icon name="plus" />}
                        onClick={() => setIsCreateOpen(true)}
                      >
                        Raise a Query Now
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
                  const isUnread =
                    !readTicketIds.has(ticket.id) &&
                    (ticket.status === "new" ||
                      (ticket.messages &&
                        ticket.messages.length > 0 &&
                        ticket.messages[ticket.messages.length - 1].sender_role !== "customer"));

                  const unreadMsgCount = ticket.messages
                    ? ticket.messages.filter((m) => m.sender_role !== "customer").length
                    : 0;

                  return (
                    <tr
                      key={ticket.id}
                      className={selectedTicket?.id === ticket.id ? "is-selected-row" : ""}
                      onClick={() => {
                        setSelectedId(ticket.id);
                        setIsChatOpen(true);
                      }}
                      style={{
                        cursor: "pointer",
                        background: isUnread
                          ? "rgba(185, 28, 43, 0.06)"
                          : selectedTicket?.id === ticket.id
                          ? "var(--surface-hover, rgba(255, 255, 255, 0.04))"
                          : undefined,
                        borderLeft: isUnread ? "4px solid var(--primary, #b91c2b)" : "4px solid transparent",
                      }}
                    >
                      <td>
                        <div className="table-item-cell">
                          <div
                            className="table-avatar-tile"
                            style={{
                              background: isUnread ? "var(--primary, #b91c2b)" : undefined,
                              color: isUnread ? "#ffffff" : undefined,
                              position: "relative",
                              flexShrink: 0,
                            }}
                          >
                            #
                          </div>
                          <div className="table-item-details" style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <strong className="table-item-title" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                                {ticket.subject}
                              </strong>
                              {isUnread && (
                                <span
                                  style={{
                                    fontSize: "0.675rem",
                                    fontWeight: 700,
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    background: "var(--primary, #b91c2b)",
                                    color: "#ffffff",
                                    boxShadow: "0 1px 4px rgba(185, 28, 43, 0.25)",
                                  }}
                                >
                                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#ffffff" }} />
                                  {unreadMsgCount > 0 ? `${unreadMsgCount} New Reply` : "New Update"}
                                </span>
                              )}
                            </div>
                            <span className="table-item-subtitle">
                              Ticket #{ticket.id} &bull; {strings.categories[ticket.category as keyof typeof strings.categories] ?? ticket.category}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone="neutral">
                          {ticket.queue === "institute"
                            ? strings.routing.institute
                            : ticket.escalated_at
                            ? strings.routing.forwarded
                            : strings.routing.platform}
                        </Badge>
                      </td>
                      <td><Badge tone={statusTone(ticket.status)}>{label(ticket.status)}</Badge></td>
                      <td><Badge tone={priorityTone(ticket.priority)}>{label(ticket.priority)}</Badge></td>
                      <td>{formatDate(ticket.created_at)}</td>
                      <td className="table-actions institute-row-actions">
                        <button
                          type="button"
                          className="action-btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(ticket.id);
                            setIsChatOpen(true);
                          }}
                        >
                          <Icon name="eye" />
                          <span>Chat</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Raise a Query Form Modal */}
      <Modal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        size="md"
        title="Raise a Query"
      >
        <form onSubmit={submitTicket} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.9rem" }}>
            {usesInstituteSupport ? strings.form.instituteDescription : strings.form.description}
          </p>

          <label className="support-field-label">
            {strings.form.category}
            <SearchableSelect
              ariaLabel={strings.form.category}
              options={CATEGORY_OPTIONS}
              searchable={false}
              value={category}
              onChange={(value) => setCategory(String(value))}
            />
          </label>

          <Input
            label={strings.form.subject}
            maxLength={220}
            placeholder={strings.form.subjectPlaceholder}
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />

          <Textarea
            label={strings.form.message}
            maxLength={5000}
            minLength={10}
            placeholder={strings.form.messagePlaceholder}
            required
            rows={5}
            showCount
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button
              leftIcon={<Icon name="help" />}
              loading={submitting}
              type="submit"
            >
              {submitting ? strings.form.submitting : strings.form.submit}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Interactive Messenger Support Chat Modal */}
      <Modal
        open={isChatOpen && Boolean(selectedTicket)}
        onClose={() => setIsChatOpen(false)}
        size="lg"
        title={
          selectedTicket ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span className="support-ticket-id" style={{ fontSize: "0.85rem", padding: "4px 10px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.08)", border: "1px solid var(--border)" }}>
                #{selectedTicket.id}
              </span>
              <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)" }}>
                {selectedTicket.subject}
              </span>
              <Badge tone={statusTone(selectedTicket.status)}>{label(selectedTicket.status)}</Badge>
              <Badge tone={priorityTone(selectedTicket.priority)}>{label(selectedTicket.priority)}</Badge>
              {selectedTicket.status !== "closed" && (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Icon name="check" />}
                  loading={saving}
                  onClick={() => void handleCloseTicket()}
                >
                  Close Ticket
                </Button>
              )}
            </div>
          ) : (
            "Support Ticket Thread"
          )
        }
      >
        {selectedTicket && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Top Bar: Support Routing Card */}
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "14px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                  ASSIGNED SUPPORT QUEUE
                </small>
                <strong style={{ fontSize: "0.95rem", color: "var(--text)", display: "block", marginTop: "2px" }}>
                  {selectedTicket.queue === "institute"
                    ? strings.routing.institute
                    : selectedTicket.escalated_at
                    ? strings.routing.forwarded
                    : strings.routing.platform}
                </strong>
              </div>
              <div>
                <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                  CATEGORY
                </small>
                <span style={{ fontSize: "0.9rem", color: "var(--text)", fontWeight: 600 }}>
                  {strings.categories[selectedTicket.category as keyof typeof strings.categories] ?? selectedTicket.category}
                </span>
              </div>
              <div>
                <small style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", fontWeight: 700, display: "block" }}>
                  SUBMITTED
                </small>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  {formatDate(selectedTicket.created_at)}
                </span>
              </div>
            </div>

            {/* Messenger Chat Thread Stream */}
            <div
              ref={chatStreamRef}
              style={{
                height: "360px",
                overflowY: "auto",
                padding: "18px",
                borderRadius: "14px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
              }}
            >
              {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                selectedTicket.messages.map((msg: SupportTicketMessage, idx: number) => {
                  const isAdmin = msg.sender_role === "admin" || msg.sender_role === "staff";
                  return (
                    <div
                      key={msg.id || idx}
                      style={{
                        alignSelf: isAdmin ? "flex-start" : "flex-end",
                        maxWidth: "80%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isAdmin ? "flex-start" : "flex-end",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            color: isAdmin ? "var(--primary, #b91c2b)" : "var(--text)",
                          }}
                        >
                          {msg.sender_name} {isAdmin ? "(Support Staff)" : "(You)"}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <div
                        style={{
                          background: isAdmin ? "rgba(255, 255, 255, 0.08)" : "var(--primary, #b91c2b)",
                          color: isAdmin ? "var(--text)" : "#ffffff",
                          border: isAdmin ? "1px solid var(--border)" : "none",
                          padding: "11px 16px",
                          borderRadius: isAdmin ? "16px 16px 16px 2px" : "16px 16px 2px 16px",
                          fontSize: "0.925rem",
                          lineHeight: 1.45,
                          whiteSpace: "pre-wrap",
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
                        }}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              ) : (
                <>
                  <div style={{ alignSelf: "flex-end", maxWidth: "80%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)" }}>You</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{formatDate(selectedTicket.created_at)}</span>
                    </div>
                    <div
                      style={{
                        background: "var(--primary, #b91c2b)",
                        color: "#ffffff",
                        padding: "11px 16px",
                        borderRadius: "16px 16px 2px 16px",
                        fontSize: "0.925rem",
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {selectedTicket.message}
                    </div>
                  </div>

                  {selectedTicket.admin_note && (
                    <div style={{ alignSelf: "flex-start", maxWidth: "80%" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--primary, #b91c2b)" }}>Support Response</span>
                      </div>
                      <div
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          color: "var(--text)",
                          border: "1px solid var(--border)",
                          padding: "11px 16px",
                          borderRadius: "16px 16px 16px 2px",
                          fontSize: "0.925rem",
                          lineHeight: 1.45,
                          whiteSpace: "pre-wrap",
                        }}
                      >
                        {selectedTicket.admin_note}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Reply Input Bar */}
            {selectedTicket.status === "closed" ? (
              <div
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  color: "#ef4444",
                  textAlign: "center",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                🔒 This support ticket is closed. If you have a new issue, please click <strong>"Raise a Query"</strong>.
              </div>
            ) : (
              <form onSubmit={handleSendMessage} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <textarea
                  className="input"
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your follow-up reply..."
                  style={{ resize: "none", borderRadius: "10px", padding: "12px", fontSize: "0.925rem", width: "100%" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Icon name="check" />}
                    loading={saving}
                    onClick={() => void handleCloseTicket()}
                  >
                    Close Ticket
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    loading={sendingMessage}
                    disabled={!replyText.trim()}
                    leftIcon={<Icon name="arrowRight" />}
                  >
                    Send Reply
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

