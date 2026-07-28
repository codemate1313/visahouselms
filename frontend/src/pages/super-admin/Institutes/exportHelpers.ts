import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { institutesStrings as strings } from "./Institutes.strings";
import type { InstituteRow } from "./types";
import { INSTITUTE_STATUS, INSTITUTE_STATUS_LABELS } from "@/constants";

function statusLabel(row: InstituteRow) {
  return row.onboarding_status === INSTITUTE_STATUS.DRAFT
    ? INSTITUTE_STATUS_LABELS.draft
    : row.is_active
      ? INSTITUTE_STATUS_LABELS.active
      : INSTITUTE_STATUS_LABELS.suspended;
}

export function exportInstitutesPDF(rows: InstituteRow[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(185, 28, 43);
  doc.rect(0, 0, 297, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(strings.pdf.header, 14, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${strings.pdf.generatedPrefix} ${new Date().toLocaleString()}`, 220, 13);

  autoTable(doc, {
    startY: 26,
    head: [strings.pdf.columns as unknown as string[]],
    body: rows.map((row, i) => [
      i + 1,
      row.name,
      row.slug,
      row.contact_email ?? "—",
      row.subscription_state,
      statusLabel(row),
      row.onboarding_status,
    ]),
    styles: {
      fontSize: 9,
      cellPadding: 4,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      3: { cellWidth: 55 },
    },
  });

  doc.save(`institutes-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportInstitutesExcel(rows: InstituteRow[]) {
  const wsData: (string | number)[][] = [
    [...strings.excel.columns],
    ...rows.map((row, i) => [
      i + 1,
      row.name,
      row.slug,
      row.contact_email ?? "",
      row.subscription_state,
      statusLabel(row),
      row.onboarding_status,
      new Date(row.created_at).toLocaleDateString(),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 20 }, { wch: 34 },
    { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.excel.sheetName);
  XLSX.writeFile(wb, `institutes-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
