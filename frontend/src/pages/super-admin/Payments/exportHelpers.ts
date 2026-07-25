import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { currencySymbol, formatCurrencyAmount } from "@/utils/currency";
import { paymentsStrings as strings } from "./Payments.strings";
import type { PaymentRow } from "./types";

export function exportPaymentsPDF(rows: PaymentRow[]) {
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
    body: rows.map((r, i) => [
      i + 1,
      r.invoice_number ?? "—",
      r.source.toUpperCase(),
      `${r.institute_name ?? "—"} ${r.plan_name ? `/ ${r.plan_name}` : ""}`,
      formatCurrencyAmount(r.amount_paid, r.currency),
      formatCurrencyAmount(r.due_amount, r.currency),
      r.status.toUpperCase(),
      new Date(r.created_at).toLocaleDateString("en-GB"),
    ]),
    styles: { fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`payments-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportPaymentsExcel(rows: PaymentRow[]) {
  const wsData: (string | number)[][] = [
    [...strings.excel.columns],
    ...rows.map((r, i) => [
      i + 1,
      r.invoice_number ?? "",
      r.source,
      r.institute_name ?? "",
      r.plan_name ?? "",
      currencySymbol(r.currency),
      r.final_amount,
      r.amount_paid,
      r.due_amount,
      r.status,
      new Date(r.created_at).toLocaleDateString("en-GB"),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 12 }, { wch: 28 }, { wch: 24 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.excel.sheetName);
  XLSX.writeFile(wb, `payments-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
