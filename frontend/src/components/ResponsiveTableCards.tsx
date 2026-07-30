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
    let frame = window.requestAnimationFrame(() => applyResponsiveTableCards());

    const observer = new MutationObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => applyResponsiveTableCards());
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return null;
}
