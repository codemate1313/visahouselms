import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type {
  SupportTicket,
  SupportTicketListResponse,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@/api/types";
import { Badge, Button, PageHeader, SearchableSelect, SearchInput, SegmentedControl } from "@/components/ui";
import { Icon } from "@/components/icons";
import { usePageTitleStore } from "@/store/pageTitleStore";
import { supportTicketsStrings as strings } from "./SupportTickets.strings";

const STATUSES: Array<SupportTicketStatus | ""> = ["", "new", "open", "resolved", "closed"];
const PRIORITIES: Array<SupportTicketPriority | ""> = ["", "low", "normal", "high"];
const QUEUE_STATUSES: Record<"active" | "resolved", SupportTicketStatus[]> = {
  active: ["new", "open"],
  resolved: ["resolved", "closed"],
};

function label(value: string) {
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

export function SupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [counts, setCounts] = useState<SupportTicketListResponse["counts"]>({
    all: 0,
    new: 0,
    open: 0,
    resolved: 0,
    closed: 0,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SupportTicketStatus | "">("");
  const [priority, setPriority] = useState<SupportTicketPriority | "">("");
  const [source, setSource] = useState<"" | "portal" | "customer">("");
  const [queue, setQueue] = useState<"active" | "resolved">("active");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<SupportTicketStatus>("new");
  const [draftPriority, setDraftPriority] = useState<SupportTicketPriority>("normal");
  const [draftNote, setDraftNote] = useState("");
  const setItemCount = usePageTitleStore((state) => state.setItemCount);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedId) ?? tickets[0] ?? null,
    [selectedId, tickets]
  );
  const queueTotal = QUEUE_STATUSES[queue].reduce((total, item) => total + (counts[item] ?? 0), 0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get<SupportTicketListResponse>("/super-admin/support-tickets", {
        params: {
          search: search.trim() || undefined,
          status: status || undefined,
          priority: priority || undefined,
          source: source || undefined,
          status_group: queue,
          page_size: 50,
        },
      });
      setTickets(data.items);
      setCounts(data.counts);
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
  }, [priority, queue, search, setItemCount, source, status]);

  useEffect(() => {
    void load();
    return () => setItemCount(null);
  }, [load, setItemCount]);

  useEffect(() => {
    if (!selectedTicket) return;
    setDraftStatus(selectedTicket.status);
    setDraftPriority(selectedTicket.priority);
    setDraftNote(selectedTicket.admin_note ?? "");
  }, [selectedTicket]);

  async function saveSelected() {
    if (!selectedTicket) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch<SupportTicket>(
        `/super-admin/support-tickets/${selectedTicket.id}`,
        {
          status: draftStatus,
          priority: draftPriority,
          admin_note: draftNote,
        }
      );
      await load();
    } catch (err: unknown) {
      setError(extractErrorMessage(err, strings.errors.update));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="support-ticket-page">
      <PageHeader
        appearance="compact"
        title={strings.title}
        subtitle={strings.subtitle}
        actions={
          <Button variant="secondary" leftIcon={<Icon name="notifications" />} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />

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

      <SegmentedControl
        className="support-ticket-queue-segment"
        ariaLabel="Ticket queue"
        options={[
          { value: "active", label: strings.filters.queues.active },
          { value: "resolved", label: strings.filters.queues.resolved },
        ]}
        value={queue}
        onChange={(value) => {
          setQueue(value);
          setStatus("");
        }}
      />

      <div className="support-ticket-stat-row">
        {(["", ...QUEUE_STATUSES[queue]] as Array<SupportTicketStatus | "">).map((item) => {
          const key = item || "all";
          return (
            <button
              key={key}
              type="button"
              className={`support-ticket-stat ${status === item ? "is-active" : ""}`}
              onClick={() => setStatus(item)}
            >
              <span>{label(key)}</span>
              <strong>{item ? counts[item] ?? 0 : queueTotal}</strong>
            </button>
          );
        })}
      </div>

      <div className="filter-bar institutes-filter-bar support-ticket-filter">
        <SearchInput
          value={search}
          onChange={setSearch}
          onKeyDown={(event) => {
            if (event.key === "Enter") void load();
          }}
          placeholder={strings.filters.search}
        />
        <SearchableSelect
          ariaLabel={strings.filters.priority}
          className="support-ticket-select"
          options={PRIORITIES.map((item) => ({
            value: item,
            label: item ? label(item) : `${strings.filters.all} ${strings.filters.priority}`,
          }))}
          searchable={false}
          value={priority}
          onChange={(value) => setPriority(String(value) as SupportTicketPriority | "")}
        />
        <Button variant="secondary" leftIcon={<Icon name="search" />} onClick={() => void load()}>
          Search
        </Button>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="support-ticket-grid">
        <div className="table-wrap support-ticket-table-wrap">
          <table className="data-table sleek-users-table support-ticket-table">
            <thead>
              <tr>
                <th>{strings.table.customer}</th>
                <th>{strings.table.enquiry}</th>
                <th>{strings.table.status}</th>
                <th>{strings.table.priority}</th>
                <th>{strings.table.received}</th>
                <th className="table-actions-heading">{strings.table.actions}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="empty-cell">{strings.loading}</td>
                </tr>
              ) : !tickets.length ? (
                <tr>
                  <td colSpan={6} className="empty-cell">{strings.table.empty}</td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className={selectedTicket?.id === ticket.id ? "is-selected-row" : ""}>
                    <td>
                      <div className="table-item-cell">
                        <div className="table-avatar-tile">{ticket.name.charAt(0).toUpperCase()}</div>
                        <div className="table-item-details">
                          <strong className="table-item-title">{ticket.name}</strong>
                          <span className="table-item-subtitle">{ticket.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="table-item-details">
                        <span className="table-item-title">{ticket.subject}</span>
                        <span className="table-item-subtitle">{ticket.institute_name || ticket.category}</span>
                      </div>
                    </td>
                    <td><Badge tone={statusTone(ticket.status)}>{label(ticket.status)}</Badge></td>
                    <td><Badge tone={priorityTone(ticket.priority)}>{label(ticket.priority)}</Badge></td>
                    <td>{formatDate(ticket.created_at)}</td>
                    <td className="table-actions institute-row-actions">
                      <button type="button" className="action-btn-icon" onClick={() => setSelectedId(ticket.id)}>
                        <Icon name="eye" />
                        <span>Open</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <aside className="support-ticket-detail">
          {selectedTicket ? (
            <>
              <div className="support-ticket-detail-head">
                <div>
                  <span className="support-ticket-id">#{selectedTicket.id}</span>
                  <h2>{selectedTicket.subject}</h2>
                </div>
                <Badge tone={statusTone(selectedTicket.status)}>{label(selectedTicket.status)}</Badge>
              </div>

              <div className="support-ticket-meta">
                <span>{strings.detail.customer}</span>
                <strong>{selectedTicket.name}</strong>
                <a href={`mailto:${selectedTicket.email}`}>{selectedTicket.email}</a>
                {selectedTicket.phone_number && <small>{strings.detail.phone}: {selectedTicket.phone_number}</small>}
                {selectedTicket.institute_name && <small>{strings.detail.institute}: {selectedTicket.institute_name}</small>}
              </div>

              <div className="support-ticket-message">
                <span>{strings.detail.message}</span>
                <p>{selectedTicket.message}</p>
              </div>

              <div className="support-ticket-form-row">
                <div className="support-ticket-field">
                  <span>{strings.filters.status}</span>
                  <SearchableSelect
                    ariaLabel={strings.filters.status}
                    className="support-ticket-select"
                    options={STATUSES.filter(Boolean).map((item) => ({
                      value: item,
                      label: label(item),
                    }))}
                    searchable={false}
                    value={draftStatus}
                    onChange={(value) => setDraftStatus(String(value) as SupportTicketStatus)}
                  />
                </div>
                <div className="support-ticket-field">
                  <span>{strings.filters.priority}</span>
                  <SearchableSelect
                    ariaLabel={strings.filters.priority}
                    className="support-ticket-select"
                    options={PRIORITIES.filter(Boolean).map((item) => ({
                      value: item,
                      label: label(item),
                    }))}
                    searchable={false}
                    value={draftPriority}
                    onChange={(value) => setDraftPriority(String(value) as SupportTicketPriority)}
                  />
                </div>
              </div>

              <label className="support-ticket-note">
                {strings.detail.note}
                <textarea
                  className="input"
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                  placeholder={strings.detail.notePlaceholder}
                  rows={5}
                />
              </label>

              <Button loading={saving} leftIcon={<Icon name="check" />} onClick={() => void saveSelected()}>
                {strings.detail.save}
              </Button>
            </>
          ) : (
            <div className="support-ticket-empty-detail">
              <Icon name="help" />
              <h2>{strings.detail.emptyTitle}</h2>
              <p>{strings.detail.emptyBody}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
