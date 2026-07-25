import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { currencySymbol, formatCurrencyAmount } from "@/utils/currency";
import { instituteOnboardingsStrings as strings } from "./InstituteOnboardings.strings";
import type { OnboardingRow } from "./types";

export function exportOnboardingsPDF(rows: OnboardingRow[]) {
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
      row.contact_email ?? "—",
      formatCurrencyAmount(row.agreed_amount || 0, row.agreement_currency),
      row.payment
        ? `${formatCurrencyAmount(row.payment.amount_paid || 0, row.agreement_currency)} (${row.payment.status || "paid"})`
        : strings.pdf.notRecorded,
      `${row.student_limit} students / ${row.staff_limit} staff (${row.member_count} accounts)`,
      row.course_count,
      row.onboarding_status === "published" ? strings.statusFilter.published : strings.statusFilter.draft,
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
      2: { cellWidth: 50 },
    },
  });

  doc.save(`institute-onboardings-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportOnboardingsExcel(rows: OnboardingRow[]) {
  const wsData: (string | number)[][] = [
    [...strings.excel.columns],
    ...rows.map((row, i) => [
      i + 1,
      row.name,
      row.contact_email ?? "",
      row.agreed_amount || "0",
      currencySymbol(row.agreement_currency),
      row.payment?.amount_paid || "0",
      row.payment?.status || "pending",
      row.student_limit,
      row.staff_limit,
      row.member_count,
      row.course_count,
      row.onboarding_status,
      new Date(row.created_at).toLocaleDateString(),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 32 }, { wch: 16 },
    { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
    { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.excel.sheetName);
  XLSX.writeFile(wb, `institute-onboardings-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
