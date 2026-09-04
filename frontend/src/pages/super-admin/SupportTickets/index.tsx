import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient, API_BASE_URL } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import type {
  SupportTicket,
  SupportTicketListResponse,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/api/types";
import { Badge, Button, Modal, SearchableSelect, SearchInput, SegmentedControl } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { Icon } from "@/components/icons";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { useToastStore } from "@/store/toastStore";
import { supportTicketsStrings as strings } from "./SupportTickets.strings";

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

const STATUSES: Array<SupportTicketStatus | ""> = ["", "new", "open", "resolved", "closed"];
const PRIORITIES: Array<SupportTicketPriority | ""> = ["", "low", "normal", "high"];

function label(value: string) {
  if (value === "new") return "Unread";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusTone(status: SupportTicketStatus) {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "open") return "info";
  return "warning";
}

function priorityTone(priority: SupportTicketPriority) {
  if (priority === "high") return "danger";
  if (priority === "low") return "neutral";
  return "info";
}

interface SupportTicketInboxProps {
  scope: "institute" | "super-admin";
}

function SupportTicketInbox({ scope }: SupportTicketInboxProps) {
  const isInstituteInbox = scope === "institute";
  const apiBase = isInstituteInbox ? "/institute/support-tickets" : "/super-admin/support-tickets";
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SupportTicketStatus | "">("");
  const [priority, setPriority] = useState<SupportTicketPriority | "">("");
  const [source, setSource] = useState<"" | "portal" | "customer">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [dragCounter, setDragCounter] = useState(0);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seenTicketMsgCounts, setSeenTicketMsgCounts] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem("visahouse_seen_ticket_msg_counts_admin");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const setItemCount = usePageTitleStore((state) => state.setItemCount);
  const showSuccess = useToastStore((state) => state.showSuccess);

  const requestChatClose = useCallback(async () => {
    if (replyText.trim() || attachedFiles.length > 0) {
      const confirmed = await confirmAction("Discard unsent reply?", {
        title: "Discard reply",
        confirmText: "Discard",
        variant: "warning",
      });
      if (!confirmed) return;
    }
    setIsChatOpen(false);
  }, [attachedFiles.length, replyText]);

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
          localStorage.setItem("visahouse_seen_ticket_msg_counts_admin", JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [isChatOpen, selectedTicket]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<SupportTicketListResponse>(apiBase, {
        params: {
          search: search.trim() || undefined,
          status: status || undefined,
          priority: priority || undefined,
          source: isInstituteInbox ? undefined : source || undefined,
          page_size: 50,
        },
      });
      setTickets(data.items);
      setItemCount(data.total);
      setSelectedId((current) => {
        if (current && data.items.some((ticket) => ticket.id === current)) return current;
        return data.items[0]?.id ?? null;
      });
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.load));
      setItemCount(null);
    } finally {
      setLoading(false);
    }
  }, [apiBase, isInstituteInbox, priority, search, setItemCount, source, status]);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    return () => setItemCount(null);
  }, [setItemCount]);

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

  // Switching to a different ticket must never carry over an in-progress
  // reply draft — otherwise a message meant for one customer can end up
  // being sent to another.
  useEffect(() => {
    setReplyText("");
    setAttachedFiles([]);
    setDragCounter(0);
  }, [selectedTicket?.id]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter((prev) => prev + 1);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragCounter(0);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(0);
    if (!selectedTicket || selectedTicket.status === "closed") return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) {
      setAttachedFiles((prev) => [...prev, ...files].slice(0, 5));
    }
  }, [selectedTicket]);

  async function handleSendMessage(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!selectedTicket || (!replyText.trim() && attachedFiles.length === 0)) return;
    setSendingMessage(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("message", replyText.trim() || "(attachment)");
      for (const file of attachedFiles) form.append("files", file);
      const { data } = await apiClient.post<SupportTicket>(`${apiBase}/${selectedTicket.id}/messages`, form);
      setReplyText("");
      setAttachedFiles([]);
      showSuccess("Reply sent successfully", "Message Sent");
      await load();
      setSelectedId(data.id);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to send reply"));
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleSendMessageAndClose() {
    if (!selectedTicket || (!replyText.trim() && attachedFiles.length === 0)) return;
    setSendingMessage(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("message", replyText.trim() || "(attachment)");
      for (const file of attachedFiles) form.append("files", file);
      await apiClient.post<SupportTicket>(`${apiBase}/${selectedTicket.id}/messages`, form);
      const { data } = await apiClient.post<SupportTicket>(`${apiBase}/${selectedTicket.id}/close`);
      setReplyText("");
      setAttachedFiles([]);
      showSuccess("Reply sent and chat closed", "Chat Closed");
      await load();
      setSelectedId(data.id);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to send reply and close chat"));
    } finally {
      setSendingMessage(false);
    }
  }

  async function closeChat() {
    if (!selectedTicket) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await apiClient.post<SupportTicket>(`${apiBase}/${selectedTicket.id}/close`);
      showSuccess("Chat closed", "Closed");
      await load();
      setSelectedId(data.id);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to close chat"));
    } finally {
      setSaving(false);
    }
  }

  async function reopenChat() {
    if (!selectedTicket) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await apiClient.post<SupportTicket>(`${apiBase}/${selectedTicket.id}/reopen`);
      showSuccess("Chat reopened", "Reopened");
      await load();
      setSelectedId(data.id);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, "Failed to reopen chat"));
    } finally {
      setSaving(false);
    }
  }

  async function forwardSelected() {
    if (!selectedTicket || !isInstituteInbox) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post(`${apiBase}/${selectedTicket.id}/forward`);
      showSuccess(strings.forward.success);
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.forward.error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`support-ticket-page${isInstituteInbox ? " support-ticket-page--institute" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", margin: "0 0 16px", flexWrap: "wrap" }}>
        {!isInstituteInbox ? (
          <SegmentedControl
            className="support-ticket-source-segment"
            ariaLabel="Support request source"
            options={[
              { value: "", label: strings.filters.sources.all },
              { value: "portal", label: strings.filters.sources.portal },
              { value: "customer", label: strings.filters.sources.customer },
            ]}
            value={source}
            onChange={(value) => setSource(value as "" | "portal" | "customer")}
          />
        ) : <div />}
        <Button variant="secondary" leftIcon={<Icon name="refresh" />} onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      <div className="filter-bar institutes-filter-bar" style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
        <div style={{ flex: "1 1 240px", minWidth: "200px" }}>
          <SearchInput
            aria-label={strings.filters.search}
            value={search}
            onChange={(val: string) => setSearch(val)}
            placeholder={strings.filters.search}
          />
        </div>
        <div style={{ width: "195px", flexShrink: 0 }}>
          <SearchableSelect
            ariaLabel={strings.filters.status}
            className="support-ticket-filter-select"
            options={STATUSES.map((item) => ({
              value: item,
              label: item ? (item === "new" ? "New / Unread" : label(item)) : `${strings.filters.status}: ${strings.filters.all}`,
            }))}
            searchable={false}
            value={status}
            onChange={(value) => setStatus(value as SupportTicketStatus | "")}
          />
        </div>
        <div style={{ width: "180px", flexShrink: 0 }}>
          <SearchableSelect
            ariaLabel={strings.filters.priority}
            className="support-ticket-filter-select"
            options={PRIORITIES.map((item) => ({
              value: item,
              label: item ? label(item) : `${strings.filters.priority}: ${strings.filters.all}`,
            }))}
            searchable={false}
            value={priority}
            onChange={(value) => setPriority(value as SupportTicketPriority | "")}
          />
        </div>
      </div>

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
                <th style={{ padding: "12px 10px 12px 16px" }}>{strings.table.customer}</th>
                <th style={{ padding: "12px 2px" }}>{strings.table.enquiry}</th>
                <th style={{ textAlign: "center", padding: "12px 4px" }}>{strings.table.status}</th>
                <th style={{ textAlign: "center", padding: "12px 4px" }}>{strings.table.priority}</th>
                <th style={{ padding: "12px 8px" }}>{strings.table.received}</th>
                <th className="table-actions-heading" style={{ textAlign: "center", padding: "12px 4px" }}>{strings.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty-cell" style={{ padding: "40px 0" }}>
                    <RouteLoadingState size={40} />
                  </td>
                </tr>
              ) : !tickets.length ? (
                <tr>
                  <td colSpan={6} className="empty-cell">{strings.table.empty}</td>
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
                        ticket.messages[ticket.messages.length - 1].sender_role === "customer"));

                  const unreadMsgCount = ticket.messages
                    ? ticket.messages.filter((m) => m.sender_role === "customer").length
                    : 1;

                  const isClosed = ticket.status === "closed" || ticket.status === "resolved";
                  const lastMsg = ticket.messages && ticket.messages.length > 0
                    ? ticket.messages[ticket.messages.length - 1]
                    : null;
                  const isAwaitingReply = !isClosed && (lastMsg ? lastMsg.sender_role === "customer" : ticket.status === "new");

                  const replySubtext = isClosed
                    ? (ticket.status === "closed" ? "✓ Ticket Closed" : "✓ Resolved")
                    : isAwaitingReply
                    ? "● Awaiting Reply"
                    : "✓ Staff Replied";

                  return (
                    <tr
                      key={ticket.id}
                      className={`${selectedTicket?.id === ticket.id ? "is-selected-row" : ""} ${
                        isUnread ? "is-unread-row" : ""
                      }`}
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
                              overflow: "visible",
                              flexShrink: 0,
                            }}
                          >
                            {ticket.name.charAt(0).toUpperCase()}
                            {isUnread && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: "-3px",
                                  right: "-3px",
                                  width: "11px",
                                  height: "11px",
                                  borderRadius: "50%",
                                  background: "#ef4444",
                                  border: "2px solid var(--surface, #ffffff)",
                                  boxShadow: "0 2px 6px rgba(239, 68, 68, 0.45)",
                                  zIndex: 2,
                                }}
                              />
                            )}
                          </div>
                          <div className="table-item-details" style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <strong className="table-item-title" style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                                {ticket.name}
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
                                  {unreadMsgCount > 1 ? `${unreadMsgCount} Msgs` : "Unread"}
                                </span>
                              )}
                            </div>
                            <span className="table-item-subtitle" style={{ whiteSpace: "nowrap", display: "block" }}>{ticket.email}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 2px" }}>
                        <div className="table-item-details">
                          <span className="table-item-title">{ticket.subject}</span>
                          <span className="table-item-subtitle">{ticket.institute_name || ticket.category}</span>
                        </div>
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
                            color: isClosed ? "var(--text-muted)" : isAwaitingReply ? "var(--primary, #b91c2b)" : "var(--text-muted)",
                          }}
                        >
                          {replySubtext}
                        </span>
                      </td>
                      <td className="table-actions institute-row-actions" style={{ textAlign: "center", padding: "12px 4px" }}>
                        <Button
                          type="button"
                          variant="secondary"
                          className="action-btn-icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(ticket.id);
                            setIsChatOpen(true);
                          }}
                        >
                          <Icon name="eye" />
                          <span>Chat</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive Support Messenger Chat Modal */}
      <Modal
        open={isChatOpen && Boolean(selectedTicket)}
        onClose={() => { void requestChatClose(); }}
        onBeforeClose={() => {
          // A half-typed reply or a picked attachment is real, easy-to-lose work -
          // Escape and outside-click are natural habits, so confirm before it's gone.
          if (replyText.trim() || attachedFiles.length > 0) {
            void requestChatClose();
            return false;
          }
          return true;
        }}
        className={isInstituteInbox ? "support-ticket-chat-modal support-ticket-chat-modal--institute" : "support-ticket-chat-modal"}
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
            </div>
          ) : (
            "Support Ticket Thread"
          )
        }
        actions={
          selectedTicket ? (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
              {selectedTicket.status === "closed" ? (

                <Button
                  size="sm"
                  variant="secondary"
                  loading={saving}
                  leftIcon={<Icon name="check" />}
                  onClick={() => void reopenChat()}
                  style={{ background: "var(--success)", color: "var(--white)", borderColor: "var(--success)" }}
                >
                  Reopen Ticket
                </Button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {isInstituteInbox && (
                    <Button
                      type="button"
                      disabled={saving}
                      leftIcon={<Icon name="arrowRight" />}
                      onClick={() => void forwardSelected()}
                      variant="secondary"
                      size="sm"
                    >
                      Forward
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    title="Attach files (images, PDF, Word, Excel — max 5, 10MB each)"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      borderRadius: "10px",
                      padding: "7px 12px",
                      fontSize: "0.875rem",
                      lineHeight: 1,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    }}
                  >
                    <Icon name="download" style={{ width: "15px", height: "15px", transform: "rotate(180deg)" }} />
                    <span>Attach</span>
                    {attachedFiles.length > 0 && (
                      <span style={{ fontSize: "0.725rem", fontWeight: 700, padding: "1px 6px", borderRadius: "10px", background: "var(--primary, #b91c2b)", color: "var(--institute-on-primary, var(--white))" }}>
                        {attachedFiles.length}
                      </span>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={saving || sendingMessage || (!replyText.trim() && attachedFiles.length === 0)}
                    onClick={() => void handleSendMessageAndClose()}
                  >
                    Send & Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    loading={sendingMessage}
                    disabled={!replyText.trim() && attachedFiles.length === 0}
                    leftIcon={<Icon name="arrowRight" />}
                    onClick={() => void handleSendMessage()}
                  >
                    Send Reply
                  </Button>
                </div>
              )}
            </div>
          ) : null
        }
      >
        {selectedTicket && (
          <div
            onDragEnter={handleDragEnter}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ display: "flex", flexDirection: "column", gap: "16px", position: "relative" }}
          >
            {dragCounter > 0 && (
              <div
                style={{
                  position: "absolute",
                  inset: -8,
                  background: "var(--background-overlay, rgba(185, 28, 43, 0.08))",
                  backdropFilter: "blur(4px)",
                  border: "2px dashed var(--primary, #b91c2b)",
                  borderRadius: "16px",
                  zIndex: 20000,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "12px",
                  color: "var(--primary, #b91c2b)",
                  pointerEvents: "none",
                }}
              >
                <div style={{ fontSize: "3rem" }}>📥</div>
                <strong style={{ fontSize: "1.1rem" }}>Drop your screenshots or files here to attach</strong>
                <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>Images, PDFs, Word, Excel (Max 5 files)</span>
              </div>
            )}
            {/* Top Bar: Customer Details Header */}
            <div
              style={{
                padding: "16px 20px",
                borderRadius: "16px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.04)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, var(--primary, #3b82f6) 0%, color-mix(in srgb, var(--primary, #3b82f6) 78%, #000000) 100%)",
                    color: "var(--institute-on-primary, #ffffff)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: "1.15rem",
                    flexShrink: 0,
                    boxShadow: "0 4px 12px color-mix(in srgb, var(--primary, #3b82f6) 28%, transparent)",
                  }}
                >
                  {selectedTicket.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <small style={{ color: "var(--text-muted)", fontSize: "0.7rem", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.5px", display: "block" }}>
                    CUSTOMER DETAILS
                  </small>
                  <strong style={{ fontSize: "1.05rem", color: "var(--text)", display: "block", marginTop: "1px", fontWeight: 700 }}>
                    {selectedTicket.name}
                  </strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "2px", flexWrap: "wrap" }}>
                    <a href={`mailto:${selectedTicket.email}`} style={{ fontSize: "0.85rem", color: "var(--primary, #0284c7)", fontWeight: 600, textDecoration: "none" }}>
                      ✉ {selectedTicket.email}
                    </a>
                    {selectedTicket.phone_number && (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 500 }}>
                        📞 {selectedTicket.phone_number}
                      </span>
                    )}
                    {selectedTicket.institute_name && (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem", fontWeight: 500 }}>
                        🏛 {selectedTicket.institute_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedTicket.status !== "closed" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={saving}
                  leftIcon={<Icon name="cross" />}
                  onClick={() => void closeChat()}
                  style={{
                    background: "color-mix(in srgb, var(--primary, #ef4444) 9%, var(--surface))",
                    color: "var(--primary, #ef4444)",
                    borderColor: "color-mix(in srgb, var(--primary, #ef4444) 28%, var(--border))",
                    borderRadius: "10px",
                    fontWeight: 600,
                    padding: "6px 14px",
                  }}
                >
                  Close Ticket
                </Button>
              ) : (
                <Badge tone="success">✓ Ticket Closed</Badge>
              )}
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
                        alignSelf: isAdmin ? "flex-end" : "flex-start",
                        maxWidth: "82%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: isAdmin ? "flex-end" : "flex-start",
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
                          {msg.sender_name} {isAdmin ? "(Admin)" : ""}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <div
                        style={{
                          background: isAdmin
                            ? "linear-gradient(135deg, var(--primary, #b91c2b) 0%, color-mix(in srgb, var(--primary, #b91c2b) 78%, #000000) 100%)"
                            : "var(--surface)",
                          color: isAdmin ? "#ffffff" : "var(--text)",
                          border: isAdmin ? "none" : "1px solid var(--border)",
                          padding: "12px 18px",
                          borderRadius: isAdmin ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                          fontSize: "0.925rem",
                          lineHeight: 1.5,
                          whiteSpace: "pre-wrap",
                          boxShadow: isAdmin
                            ? "0 4px 14px color-mix(in srgb, var(--primary, #b91c2b) 20%, transparent)"
                            : "0 2px 10px rgba(0, 0, 0, 0.04)",
                        }}
                      >
                        {!isAttachmentOnly && msg.message}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: isAttachmentOnly ? 0 : "10px" }}>
                            {msg.attachments.map((path, i) => (
                              <AttachmentPreview key={i} path={path} isLight={isAdmin} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ alignSelf: "flex-start", maxWidth: "80%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)" }}>{selectedTicket.name}</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{formatDate(selectedTicket.created_at)}</span>
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
                    {selectedTicket.message}
                  </div>
                </div>
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
                🔒 This support ticket is closed. Click <strong>"Reopen Ticket"</strong> above to continue.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                  placeholder="Type your reply to customer..."
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
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function SupportTickets() {
  return <SupportTicketInbox scope="super-admin" />;
}

export function InstituteSupportTickets() {
  return <SupportTicketInbox scope="institute" />;
}
