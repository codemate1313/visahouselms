import { useEffect } from "react";

function labelForHeader(header: HTMLTableCellElement, index: number) {
  if (header.classList.contains("table-select-heading") || header.classList.contains("col-checkbox")) {
    return "Select";
  }

  const explicitLabel = header.getAttribute("aria-label") || header.getAttribute("title");
  const visibleLabel = header.textContent?.replace(/\s+/g, " ").trim();
  return explicitLabel || visibleLabel || `Column ${index + 1}`;
}

function applyResponsiveTableCards(root: ParentNode = document) {
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    if (
      table.classList.contains("pdf-sheet-table") ||
      table.closest(".invoice-pdf-replica-sheet") ||
      table.getAttribute("data-no-responsive") === "true"
    ) {
      return;
    }

    const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th")).map(labelForHeader);

    if (headers.length === 0) {
      return;
    }

    if (!table.classList.contains("responsive-data-table")) {
      table.classList.add("responsive-data-table");
    }

    table.querySelectorAll<HTMLTableCellElement>("thead th").forEach((header, index) => {
      const label = headers[index];

      if (label && header.dataset.columnLabel !== label) {
        header.dataset.columnLabel = label;
      }
    });

    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLTableCellElement) || cell.colSpan > 1) {
          return;
        }

        const label = headers[index];

        if (label && cell.dataset.label !== label) {
          cell.dataset.label = label;
        }
      });
    });
  });
}

export function ResponsiveTableCards() {
  useEffect(() => {
    // This scans every table in the document, so it must not run on every
    // mutation. The observer watches the whole body subtree, which fires
    // constantly during navigation and list rendering; a rAF per mutation still
    // meant a full-document table scan on nearly every frame that changed the
    // DOM. Debouncing collapses a burst of mutations into a single scan once
    // things settle, which is all this needs - labels only have to be right by
    // the time the user looks, not mid-render.
    let timer: number | undefined;
    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => applyResponsiveTableCards(), 150);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
