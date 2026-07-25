import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCurrencyAmount } from "@/utils/currency";
import { couponsStrings as strings } from "./Coupons.strings";
import type { CouponRow } from "./types";

export function exportCouponsPDF(coupons: CouponRow[]) {
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
    body: coupons.map((c, i) => [
      i + 1,
      c.code,
      c.discount_type === "percent" ? `${c.value}%` : formatCurrencyAmount(c.value),
      c.scope,
      `${c.usage_count}${c.usage_limit ? ` / ${c.usage_limit}` : ""}`,
      `${c.valid_from ? new Date(c.valid_from).toLocaleDateString("en-GB") : "—"} to ${c.valid_until ? new Date(c.valid_until).toLocaleDateString("en-GB") : "—"}`,
      c.is_active ? strings.statusFilter.active : strings.statusFilter.inactive,
    ]),
    styles: { fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`coupons-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportCouponsExcel(coupons: CouponRow[]) {
  const wsData: (string | number)[][] = [
    [...strings.excel.columns],
    ...coupons.map((c, i) => [
      i + 1,
      c.code,
      c.discount_type,
      c.value,
      c.scope,
      c.usage_count,
      c.usage_limit ?? strings.excel.unlimited,
      c.valid_from ? new Date(c.valid_from).toLocaleDateString("en-GB") : "",
      c.valid_until ? new Date(c.valid_until).toLocaleDateString("en-GB") : "",
      c.is_active ? strings.statusFilter.active : strings.statusFilter.inactive,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.excel.sheetName);
  XLSX.writeFile(wb, `coupons-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
