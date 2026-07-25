import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { InstructorAccount } from "@/api/types";
import { instructorsStrings as strings } from "./Instructors.strings";

export function exportInstructorsPDF(instructors: InstructorAccount[]) {
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
    body: instructors.map((ins, i) => [
      i + 1,
      `${ins.first_name} ${ins.last_name}`,
      `${ins.title ? `${ins.title} · ` : ""}${ins.email}`,
      ins.is_active ? strings.statusFilter.active : strings.statusFilter.inactive,
      new Date(ins.created_at).toLocaleDateString("en-GB"),
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
  });

  doc.save(`sa-instructors-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportInstructorsExcel(instructors: InstructorAccount[]) {
  const wsData: (string | number)[][] = [
    [...strings.excel.columns],
    ...instructors.map((ins, i) => [
      i + 1,
      ins.first_name,
      ins.last_name,
      ins.title ?? "",
      ins.email,
      ins.is_active ? strings.statusFilter.active : strings.statusFilter.inactive,
      ins.force_password_reset ? strings.excel.yes : strings.excel.no,
      new Date(ins.created_at).toLocaleDateString("en-GB"),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.excel.sheetName);
  XLSX.writeFile(wb, `sa-instructors-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
