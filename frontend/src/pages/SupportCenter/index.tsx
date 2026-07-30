import { type FormEvent, useCallback, useEffect, useState } from "react";
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
  const [tickets, setTickets] = useState<PortalSupportTicket[]>([]);
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showSuccess = useToastStore((state) => state.showSuccess);

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
      <PageHeader eyebrow={strings.eyebrow} title={strings.title} subtitle={strings.subtitle} />

      {error && <p className="error-text">{error}</p>}

      <div className="support-center-grid">
        <Card as="form" className="support-query-form" onSubmit={submitTicket}>
          <div className="support-panel-heading">
            <h2>{strings.form.title}</h2>
            <p>{strings.form.description}</p>
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
                <Card as="article" className="support-ticket-card" key={ticket.id} size="sm">
                  <div className="support-ticket-card-head">
                    <h3>{ticket.subject}</h3>
                    <Badge tone={statusTone(ticket.status)}>{strings.status[ticket.status]}</Badge>
                  </div>
                  <p>{ticket.message}</p>
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
    </div>
  );
}
