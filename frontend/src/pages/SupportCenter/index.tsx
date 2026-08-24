import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient, API_BASE_URL } from "@/api/client";
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

function AttachmentPreview({ path, isLight }: { path: string; isLight?: boolean }) {
  const url = path.startsWith("http") ? path : API_BASE_URL + path;
  // Signed URLs carry ?exp=&sig=, so strip the query before sniffing the
  // extension or deriving a display name.
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const bare = path.split("?")[0];
  const isImage = /\.(png|jpg|jpeg|webp|gif)$/i.test(bare);
  const isPdf = /\.pdf$/i.test(bare);
  const filename = bare.split("/").pop() ?? bare;
  const cleanName = filename.length > 28 ? filename.slice(0, 25) + "..." : filename;

  if (isImage) {
    return (
      <>
        <div
          onClick={() => setIsPreviewOpen(true)}
          style={{
            display: "inline-block",
            position: "relative",
            borderRadius: "12px",
            overflow: "hidden",
            border: isLight ? "1px solid rgba(255,255,255,0.3)" : "1px solid var(--border)",
            boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
            cursor: "pointer",
          }}
        >
          <img
            src={url}
            alt={filename}
            style={{
              maxWidth: "220px",
              maxHeight: "160px",
              display: "block",
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "6px",
              right: "6px",
              background: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(6px)",
              color: "#ffffff",
              padding: "3px 8px",
              borderRadius: "8px",
              fontSize: "0.7rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Icon name="eye" style={{ width: "12px", height: "12px" }} /> Preview
          </div>
        </div>

        {isPreviewOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0, 0, 0, 0.85)",
              backdropFilter: "blur(8px)",
              zIndex: 999999,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
            }}
            onClick={() => setIsPreviewOpen(false)}
          >
            {/* Header Actions */}
            <div
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                zIndex: 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Download Button */}
              <a
                href={url}
                download={filename}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 18px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  color: "#ffffff",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  cursor: "pointer",
                }}
              >
                <Icon name="download" style={{ width: "16px", height: "16px" }} />
                <span>Download</span>
              </a>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "1.25rem",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Main Image Container */}
            <div
              style={{
                position: "relative",
                maxWidth: "90%",
                maxHeight: "80%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={url}
                alt={filename}
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  borderRadius: "8px",
                  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                  objectFit: "contain",
                }}
              />
            </div>

            {/* Bottom Filename */}
            <div style={{ marginTop: "16px", color: "rgba(255, 255, 255, 0.7)", fontSize: "0.85rem", fontWeight: 500 }}>
              {filename}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 14px",
        borderRadius: "10px",
        background: isLight ? "rgba(255, 255, 255, 0.18)" : "var(--surface-hover, rgba(0, 0, 0, 0.04))",
        border: `1px solid ${isLight ? "rgba(255, 255, 255, 0.3)" : "var(--border)"}`,
        fontSize: "0.825rem",
        fontWeight: 600,
        color: isLight ? "#ffffff" : "var(--text)",
        textDecoration: "none",
        boxShadow: isLight ? "0 2px 8px rgba(0,0,0,0.1)" : "0 2px 6px rgba(0,0,0,0.03)",
      }}
    >
      <Icon name={isPdf ? "filePdf" : "download"} style={{ width: "16px", height: "16px", flexShrink: 0 }} />
      <span>{cleanName}</span>
      <Icon name="arrowRight" style={{ width: "12px", height: "12px", opacity: 0.7 }} />
    </a>
  );
}

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
  const [seenTicketMsgCounts, setSeenTicketMsgCounts] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem("visahouse_seen_ticket_msg_counts");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [category, setCategory] = useState(() => searchParams.get("category") || "general");
  const [subject, setSubject] = useState(() => searchParams.get("subject") || "");
  const [message, setMessage] = useState("");
  const [replyText, setReplyText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const role = useAuthStore((state) => state.user?.role);
  const usesInstituteSupport = role === "STUDENT" || role === "INST_INSTRUCTOR";

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null,
    [selectedId, tickets]
  );

  useEffect(() => {
    if (isChatOpen && selectedTicket) {
      const currentMsgCount = selectedTicket.messages ? selectedTicket.messages.length : 1;
      setSeenTicketMsgCounts((prev) => {
        if (prev[selectedTicket.id] === currentMsgCount) return prev;
        const next = { ...prev, [selectedTicket.id]: currentMsgCount };
        try {
          localStorage.setItem("visahouse_seen_ticket_msg_counts", JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [isChatOpen, selectedTicket]);

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
    const ticketIdParam = searchParams.get("ticketId");
    if (ticketIdParam && !isNaN(Number(ticketIdParam))) {
      const targetId = Number(ticketIdParam);
      setSelectedId(targetId);
      setIsChatOpen(true);
    }
  }, [searchParams]);

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
    if (!selectedTicket || (!replyText.trim() && attachedFiles.length === 0)) return;
    setSendingMessage(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("message", replyText.trim() || "(attachment)");
      for (const file of attachedFiles) form.append("files", file);
      const { data: updatedTicket } = await apiClient.post<PortalSupportTicket>(
        `/support/my-tickets/${selectedTicket.id}/messages`,
        form
      );
      setReplyText("");
      setAttachedFiles([]);
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

  const isTicketClosed = selectedTicket ? (selectedTicket.status === "closed" || selectedTicket.status === "resolved") : false;
  const lastMsgSenderRole = selectedTicket?.messages && selectedTicket.messages.length > 0
    ? selectedTicket.messages[selectedTicket.messages.length - 1].sender_role
    : null;
  const isClosedByCustomer = isTicketClosed && (
    selectedTicket?.closed_by_role === "customer" ||
    (!selectedTicket?.closed_by_role && lastMsgSenderRole === "customer")
  );

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
          <table className="data-table institute-table" style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
            <colgroup>
              <col style={{ width: "26%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: "12px 10px 12px 16px" }}>{strings.table?.enquiry ?? "Enquiry"}</th>
                <th style={{ padding: "12px 2px" }}>Routing</th>
                <th style={{ textAlign: "center", padding: "12px 4px" }}>{strings.table?.status ?? "Status"}</th>
                <th style={{ textAlign: "center", padding: "12px 4px" }}>Priority</th>
                <th style={{ padding: "12px 8px" }}>Submitted On</th>
                <th className="table-actions-heading" style={{ textAlign: "center", padding: "12px 4px" }}>{strings.table?.actions ?? "Actions"}</th>
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
                  const totalMsgs = ticket.messages ? ticket.messages.length : 1;
                  const seenCount = seenTicketMsgCounts[ticket.id] ?? 0;
                  const isSeen = seenCount >= totalMsgs;

                  const isUnread =
                    !isSeen &&
                    (ticket.status === "new" ||
                      (ticket.messages &&
                        ticket.messages.length > 0 &&
                        ticket.messages[ticket.messages.length - 1].sender_role !== "customer"));

                  const unreadMsgCount = ticket.messages
                    ? ticket.messages.filter((m) => m.sender_role !== "customer").length
                    : 0;

                  const isClosed = ticket.status === "closed" || ticket.status === "resolved";
                  const lastMsg = ticket.messages && ticket.messages.length > 0
                    ? ticket.messages[ticket.messages.length - 1]
                    : null;
                  const isStaffReplied = lastMsg ? lastMsg.sender_role !== "customer" : false;

                  const replySubtext = isClosed
                    ? (ticket.status === "closed" ? "✓ Ticket Closed" : "✓ Resolved")
                    : isStaffReplied
                    ? "✓ Support Replied"
                    : "● Query Submitted";

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
                      <td style={{ padding: "12px 10px 12px 16px" }}>
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
                                    color: "var(--white)",
                                    boxShadow: "0 1px 4px rgba(185, 28, 43, 0.25)",
                                  }}
                                >
                                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor" }} />
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
                      <td style={{ padding: "12px 2px" }}>
                        <Badge tone="neutral">
                          {ticket.queue === "institute"
                            ? strings.routing.institute
                            : ticket.escalated_at
                            ? strings.routing.forwarded
                            : strings.routing.platform}
                        </Badge>
                      </td>
                      <td style={{ textAlign: "center", padding: "12px 4px" }}><Badge tone={statusTone(ticket.status)}>{label(ticket.status)}</Badge></td>
                      <td style={{ textAlign: "center", padding: "12px 4px" }}><Badge tone={priorityTone(ticket.priority)}>{label(ticket.priority)}</Badge></td>
                      <td style={{ padding: "12px 8px" }}>
                        <span style={{ display: "block", fontSize: "0.85rem" }}>{formatDate(ticket.created_at)}</span>
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: "0.725rem",
                            fontWeight: 600,
                            marginTop: "2px",
                            color: isClosed ? "var(--text-muted)" : isStaffReplied ? "var(--success, #10b981)" : "var(--text-muted)",
                          }}
                        >
                          {replySubtext}
                        </span>
                      </td>
                      <td className="table-actions institute-row-actions" style={{ textAlign: "center", padding: "12px 4px" }}>
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
              {!isTicketClosed ? (
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Icon name="check" />}
                  loading={saving}
                  onClick={() => void handleCloseTicket()}
                >
                  Close Ticket
                </Button>
              ) : null}
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
                  const isAttachmentOnly = /^\(attachment\)$/i.test(msg.message.trim());
                  return (
                    <div
                      key={msg.id || idx}
                      style={{
                        alignSelf: isAdmin ? "flex-start" : "flex-end",
                        maxWidth: "82%",
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
                          background: isAdmin
                            ? "var(--surface)"
                            : "linear-gradient(135deg, var(--primary, #b91c2b) 0%, #991b1b 100%)",
                          color: isAdmin ? "var(--text)" : "#ffffff",
                          border: isAdmin ? "1px solid var(--border)" : "none",
                          padding: "12px 18px",
                          borderRadius: isAdmin ? "18px 18px 18px 4px" : "18px 18px 4px 18px",
                          fontSize: "0.925rem",
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          boxShadow: isAdmin
                            ? "0 2px 10px rgba(0, 0, 0, 0.04)"
                            : "0 4px 14px rgba(185, 28, 43, 0.2)",
                        }}
                      >
                        {!isAttachmentOnly && msg.message}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: isAttachmentOnly ? 0 : "10px" }}>
                            {msg.attachments.map((path, i) => (
                              <AttachmentPreview key={i} path={path} isLight={!isAdmin} />
                            ))}
                          </div>
                        )}
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
            {isTicketClosed ? (
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
                {isClosedByCustomer ? (
                  <>🔒 You closed this support ticket. If you have a new issue, please click <strong>"Raise a Query"</strong>.</>
                ) : (
                  <>🔒 This support ticket is closed. Only the assigned support team can reopen it.</>
                )}
              </div>
            ) : (
              <form onSubmit={handleSendMessage} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {/* Attachment preview strip */}
                {attachedFiles.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "8px 10px", borderRadius: "8px", background: "var(--surface-hover, rgba(0,0,0,0.04))", border: "1px solid var(--border)" }}>
                    {attachedFiles.map((f, i) => (
                      <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "20px", background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.78rem", fontWeight: 600 }}>
                        {f.type.startsWith("image/") ? "🖼" : "📎"} {f.name.length > 22 ? f.name.slice(0, 20) + "..." : f.name}
                        <button type="button" onClick={() => setAttachedFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "0 2px", fontSize: "0.9rem" }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  className="input"
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your follow-up reply..."
                  style={{ resize: "none", borderRadius: "10px", padding: "12px", fontSize: "0.925rem", width: "100%" }}
                />
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files ?? []);
                    setAttachedFiles(prev => [...prev, ...newFiles].slice(0, 5));
                    e.target.value = "";
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {selectedTicket.status !== "closed" && (
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
                    )}
                    <button
                      type="button"
                      title="Attach files (images, PDF, Word, Excel — max 5, 10MB each)"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        padding: "7px 12px",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        lineHeight: 1,
                        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      }}
                    >
                      <Icon name="download" style={{ width: "15px", height: "15px", transform: "rotate(180deg)" }} />
                      <span>Attach</span>
                      {attachedFiles.length > 0 && (
                        <span style={{ fontSize: "0.725rem", fontWeight: 700, padding: "1px 6px", borderRadius: "10px", background: "var(--primary, #b91c2b)", color: "var(--white)" }}>
                          {attachedFiles.length}
                        </span>
                      )}
                    </button>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    loading={sendingMessage}
                    disabled={!replyText.trim() && attachedFiles.length === 0}
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
