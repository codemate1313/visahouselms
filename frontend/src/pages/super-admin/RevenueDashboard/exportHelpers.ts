import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { revenueDashboardStrings as strings } from "./RevenueDashboard.strings";
import { formatCurrency } from "./helpers";
import type { Summary } from "./types";

export function exportRevenuePDF(summary: Summary) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(185, 28, 43);
  doc.rect(0, 0, 297, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(strings.pdf.header, 14, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${strings.pdf.generatedPrefix} ${new Date().toLocaleString()}`, 215, 13);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(strings.pdf.kpiOverview, 14, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    strings.pdf.kpiLine(
      formatCurrency(summary.total_revenue),
      formatCurrency(summary.b2b_revenue),
      formatCurrency(summary.b2c_revenue),
      formatCurrency(summary.total_due),
      summary.transaction_count
    ),
    14,
    34
  );

  autoTable(doc, {
    startY: 40,
    head: [strings.pdf.columns as unknown as string[]],
    body: summary.by_institute.map((row, i) => [
      i + 1,
      row.institute_name,
      formatCurrency(row.total),
      row.count,
    ]),
    styles: { fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`revenue-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportRevenueExcel(summary: Summary) {
  const e = strings.excel;
  const wsData: (string | number)[][] = [
    [e.metricSummary],
    [e.totalRevenue, formatCurrency(summary.total_revenue)],
    [e.b2bInstitutes, formatCurrency(summary.b2b_revenue)],
    [e.b2cDirect, formatCurrency(summary.b2c_revenue)],
    [e.totalDue, formatCurrency(summary.total_due)],
    [e.totalTransactions, summary.transaction_count],
    [],
    [e.revenueByInstitute],
    [...e.columns],
    ...summary.by_institute.map((row, i) => [
      i + 1,
      row.institute_name,
      row.total,
      row.count,
    ]),
    [],
    [e.revenueByMonth],
    [...e.monthColumns],
    ...summary.by_month.map((row, i) => [
      i + 1,
      row.month,
      row.total,
      row.count,
    ]),
    [],
    [e.revenueByMethod],
    [...e.methodColumns],
    ...summary.by_method.map((row, i) => [
      i + 1,
      row.payment_method_name,
      row.total,
      row.count,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 15 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, e.sheetName);
  XLSX.writeFile(wb, `revenue-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
