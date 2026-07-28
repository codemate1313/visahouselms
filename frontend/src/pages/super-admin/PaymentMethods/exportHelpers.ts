import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { paymentMethodsStrings as strings } from "./PaymentMethods.strings";
import type { MethodRow } from "./types";
import { ACTIVATION_STATUS_LABELS } from "@/constants";

export function exportMethodsPDF(methods: MethodRow[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFillColor(185, 28, 43);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(strings.pdf.header, 14, 12);

  autoTable(doc, {
    startY: 24,
    head: [strings.pdf.columns as unknown as string[]],
    body: methods.map((m, i) => [i + 1, m.name, m.is_active ? ACTIVATION_STATUS_LABELS.active : ACTIVATION_STATUS_LABELS.inactive]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
  });

  doc.save(`payment-methods-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportMethodsExcel(methods: MethodRow[]) {
  const wsData: (string | number)[][] = [
    [...strings.excel.columns],
    ...methods.map((m, i) => [i + 1, m.name, m.is_active ? ACTIVATION_STATUS_LABELS.active : ACTIVATION_STATUS_LABELS.inactive]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.excel.sheetName);
  XLSX.writeFile(wb, `payment-methods-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
