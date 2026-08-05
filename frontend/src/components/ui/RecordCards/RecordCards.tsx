import type { ReactNode } from "react";
import "./RecordCards.css";

export interface RecordField<T> {
  label: string;
  render: (row: T) => ReactNode;
  /** Puts the value on its own line under the label, for wide content. */
  stacked?: boolean;
}

export interface RecordCardsProps<T> {
  rows: T[];
  fields: RecordField<T>[];
  getKey: (row: T) => string | number;
  /** The headline of the card - usually the avatar and name. */
  renderLead?: (row: T) => ReactNode;
  /** Sits opposite the lead, e.g. a selection checkbox. */
  renderSelect?: (row: T) => ReactNode;
  /** Footer row for the buttons that would be the Actions column. */
  renderActions?: (row: T) => ReactNode;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}

/**
 * The mobile presentation of a data table.
 *
 * Deliberately not a `<table>`. The tables in this app are built to scroll
 * sideways on a desktop and carry ~150 `!important` declarations pinning column
 * widths, row heights and alignment - all of it written without media queries.
 * Restyling that into cards meant fighting every one of those rules and
 * discovering the next one only when something looked wrong on a phone.
 *
 * So on small screens the table is not restyled, it is not rendered: this
 * renders instead, in its own class namespace, where no column width can reach
 * it. Each caller declares its fields once and both layouts read from them.
 */
export function RecordCards<T>({
  rows,
  fields,
  getKey,
  renderLead,
  renderSelect,
  renderActions,
  onRowClick,
  empty,
}: RecordCardsProps<T>) {
  if (rows.length === 0) {
    return <div className="record-cards-empty">{empty ?? "Nothing to show."}</div>;
  }

  return (
    <div className="record-cards">
      {rows.map((row) => (
        <article
          className={`record-card${onRowClick ? " is-clickable" : ""}`}
          key={getKey(row)}
          // The whole card is the target on a phone; a row-sized tap area is
          // easier to hit than any control inside it.
          onClick={
            onRowClick
              ? (event) => {
                  // Let the controls inside the card do their own job.
                  if ((event.target as HTMLElement).closest("button, a, input, label")) return;
                  onRowClick(row);
                }
              : undefined
          }
        >
          {(renderLead || renderSelect) && (
            <header className="record-card-head">
              {renderSelect && <div className="record-card-select">{renderSelect(row)}</div>}
              {renderLead && <div className="record-card-lead">{renderLead(row)}</div>}
            </header>
          )}

          <dl className="record-card-fields">
            {fields.map((field) => (
              <div
                className={`record-card-field${field.stacked ? " is-stacked" : ""}`}
                key={field.label}
              >
                <dt>{field.label}</dt>
                <dd>{field.render(row)}</dd>
              </div>
            ))}
          </dl>

          {renderActions && <footer className="record-card-actions">{renderActions(row)}</footer>}
        </article>
      ))}
    </div>
  );
}
