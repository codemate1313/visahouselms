import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { currencySymbol, formatCurrencyAmount } from "@/utils/currency";
import { plansStrings as strings } from "./Plans.strings";
import type { PlanRow } from "./types";
import { CATALOGUE_STATUS_LABELS } from "@/constants";

function statusLabel(plan: PlanRow) {
  return !plan.is_active
    ? CATALOGUE_STATUS_LABELS.inactive
    : plan.is_published
      ? CATALOGUE_STATUS_LABELS.active
      : CATALOGUE_STATUS_LABELS.draft;
}

export function exportPlansPDF(plans: PlanRow[]) {
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
    body: plans.map((plan, i) => [
      i + 1,
      plan.name,
      formatCurrencyAmount(plan.price, plan.currency),
      `${plan.duration_days} days`,
      `${plan.student_limit} / ${plan.staff_limit} / ${plan.test_limit}`,
      `${plan.grace_days} days`,
      plan.module_count,
      plan.subscription_count,
      statusLabel(plan),
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
      1: { cellWidth: 50 },
    },
  });

  doc.save(`subscription-plans-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportPlansExcel(plans: PlanRow[]) {
  const wsData: (string | number)[][] = [
    [...strings.excel.columns],
    ...plans.map((plan, i) => [
      i + 1,
      plan.name,
      plan.description ?? "",
      plan.price,
      currencySymbol(plan.currency),
      plan.duration_days,
      plan.student_limit,
      plan.staff_limit,
      plan.test_limit,
      plan.grace_days,
      plan.module_count,
      plan.subscription_count,
      statusLabel(plan),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 5 }, { wch: 28 }, { wch: 36 }, { wch: 12 },
    { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 14 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.excel.sheetName);
  XLSX.writeFile(wb, `subscription-plans-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
