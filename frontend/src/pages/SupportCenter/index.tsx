import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { PortalSupportTicket, SupportTicketStatus } from "@/api/types";
import { Icon } from "@/components/icons";
import {
  Badge,
  type BadgeTone,
  Button,
  Card,
  Input,
  PageHeader,
  SearchableSelect,
  Textarea,
} from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import { supportCenterStrings as strings } from "./SupportCenter.strings";
import "./SupportCenter.css";

const CATEGORY_OPTIONS = Object.entries(strings.categories).map(([value, label]) => ({ value, label }));

function statusTone(status: SupportTicketStatus): BadgeTone {
  if (status === "resolved" || status === "closed") return "success";
  if (status === "open") return "info";
  return "warning";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function SupportCenter() {
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<PortalSupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<PortalSupportTicket | null>(null);
  const [category, setCategory] = useState(() => searchParams.get("category") || "general");
  const [subject, setSubject] = useState(() => searchParams.get("subject") || "");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const role = useAuthStore((state) => state.user?.role);
  const usesInstituteSupport = role === "STUDENT" || role === "INST_INSTRUCTOR";

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
    if (!selectedTicket) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedTicket(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedTicket]);

  async function submitTicket(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/support/my-tickets", {
        category,
        subject: subject.trim(),
        message: message.trim(),
      });
      setCategory("general");
      setSubject("");
      setMessage("");
      showSuccess(strings.success);
      await loadTickets();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.submit));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="support-center-page">
      <PageHeader
        eyebrow={strings.eyebrow}
        title={strings.title}
        subtitle={usesInstituteSupport ? strings.instituteSubtitle : strings.subtitle}
      />

      {error && <p className="error-text">{error}</p>}

      <div className="support-center-grid">
        <Card as="form" className="support-query-form" onSubmit={submitTicket}>
          <div className="support-panel-heading">
            <h2>{strings.form.title}</h2>
            <p>{usesInstituteSupport ? strings.form.instituteDescription : strings.form.description}</p>
          </div>

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
            rows={7}
            showCount
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />

          <Button
            fullWidth
            leftIcon={<Icon name="help" />}
            loading={submitting}
            type="submit"
          >
            {submitting ? strings.form.submitting : strings.form.submit}
          </Button>
        </Card>

        <section className="support-ticket-history">
          <div className="support-history-heading">
            <div className="support-panel-heading">
              <h2>{strings.history.title}</h2>
              <p>{strings.history.description}</p>
            </div>
            <Button
              leftIcon={<Icon name="restore" />}
              onClick={() => void loadTickets()}
              size="sm"
              variant="secondary"
            >
              {strings.history.refresh}
            </Button>
          </div>

          {loading ? (
            <p className="empty-message">{strings.history.loading}</p>
          ) : tickets.length === 0 ? (
            <Card className="support-ticket-empty" tone="muted">
              <h3>{strings.history.emptyTitle}</h3>
              <p>{strings.history.emptyDescription}</p>
            </Card>
          ) : (
            <div className="support-ticket-list">
              {tickets.map((ticket) => (
                <Card
                  as="article"
                  aria-label={`${strings.history.openDetail}: ${ticket.subject}`}
                  className="support-ticket-card"
                  interactive
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedTicket(ticket);
                    }
                  }}
                  role="button"
                  size="sm"
                  tabIndex={0}
                  title={strings.history.openDetail}
                >
                  <div className="support-ticket-card-head">
                    <h3>{ticket.subject}</h3>
                    <Badge tone={statusTone(ticket.status)}>{strings.status[ticket.status]}</Badge>
                  </div>
                  <span className="support-ticket-destination">
                    {ticket.queue === "institute"
                      ? strings.routing.institute
                      : ticket.escalated_at
                        ? strings.routing.forwarded
                        : strings.routing.platform}
                  </span>
                  <p>{ticket.message}</p>
                  {ticket.admin_note && (
                    <div className="support-ticket-response-preview">
                      <span>{strings.detail.supportResponse}</span>
                      <p>{ticket.admin_note}</p>
                    </div>
                  )}
                  <div className="support-ticket-card-meta">
                    <span>{strings.history.ticketNumber(ticket.id)}</span>
                    <span>{strings.categories[ticket.category as keyof typeof strings.categories] ?? ticket.category}</span>
                    <time dateTime={ticket.created_at}>{formatDate(ticket.created_at)}</time>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedTicket && (
        <div
          className="support-ticket-detail-backdrop"
          onClick={() => setSelectedTicket(null)}
          role="presentation"
        >
          <aside
            aria-labelledby="support-ticket-detail-title"
            aria-modal="true"
            className="support-ticket-detail-panel"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="support-ticket-detail-head">
              <div>
                <span className="support-ticket-detail-id">{strings.history.ticketNumber(selectedTicket.id)}</span>
                <h2 id="support-ticket-detail-title">{selectedTicket.subject}</h2>
              </div>
              <button
                aria-label={strings.detail.close}
                className="support-ticket-detail-close"
                onClick={() => setSelectedTicket(null)}
                type="button"
              >
                <Icon name="x" />
              </button>
            </div>

            <div className="support-ticket-detail-meta">
              <Badge tone={statusTone(selectedTicket.status)}>{strings.status[selectedTicket.status]}</Badge>
              <span>
                {selectedTicket.queue === "institute"
                  ? strings.routing.institute
                  : selectedTicket.escalated_at
                    ? strings.routing.forwarded
                    : strings.routing.platform}
              </span>
              <span>{strings.categories[selectedTicket.category as keyof typeof strings.categories] ?? selectedTicket.category}</span>
              <time dateTime={selectedTicket.created_at}>{formatDate(selectedTicket.created_at)}</time>
            </div>

            <section className="support-ticket-detail-section">
              <h3>{strings.detail.originalQuery}</h3>
              <p>{selectedTicket.message}</p>
            </section>

            <section className="support-ticket-detail-section support-ticket-response-detail">
              <h3>{strings.detail.supportResponse}</h3>
              <p>{selectedTicket.admin_note || strings.detail.noResponse}</p>
            </section>

            <div className="support-ticket-detail-dates">
              {selectedTicket.resolved_at && (
                <span>{strings.detail.resolvedOn}: {formatDate(selectedTicket.resolved_at)}</span>
              )}
              {selectedTicket.updated_at && (
                <span>{strings.detail.updatedOn}: {formatDate(selectedTicket.updated_at)}</span>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
