import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { demoAccountsStrings as strings } from "./DemoAccounts.strings";
import type { DemoRow } from "./types";

export function exportDemoAccountsPDF(rows: DemoRow[]) {
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
      row.institute_name,
      strings.table.coursesTestsSuffix(row.course_limit, row.test_limit),
      new Date(row.expires_at).toLocaleDateString("en-GB"),
      row.days_remaining ?? "—",
      row.state.toUpperCase(),
    ]),
    styles: { fontSize: 9, cellPadding: 4, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`demo-accounts-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportDemoAccountsExcel(rows: DemoRow[]) {
  const wsData: (string | number)[][] = [
    [...strings.excel.columns],
    ...rows.map((row, i) => [
      i + 1,
      row.institute_name,
      row.course_limit,
      row.test_limit,
      row.duration_days,
      new Date(row.expires_at).toLocaleDateString("en-GB"),
      row.days_remaining ?? 0,
      row.state,
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.excel.sheetName);
  XLSX.writeFile(wb, `demo-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
