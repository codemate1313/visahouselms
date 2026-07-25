import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { SuperAdminAccount } from "@/api/types";
import { accountsListStrings as strings } from "./AccountsList.strings";

export function exportAccountsPDF(accounts: SuperAdminAccount[]) {
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
    body: accounts.map((acc, i) => [
      i + 1,
      `${acc.first_name} ${acc.last_name}`,
      acc.email,
      acc.is_active ? strings.statusFilter.active : strings.statusFilter.inactive,
      new Date(acc.created_at).toLocaleDateString("en-GB"),
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
  });

  doc.save(`admin-accounts-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportAccountsExcel(accounts: SuperAdminAccount[]) {
  const wsData: (string | number)[][] = [
    [...strings.excel.columns],
    ...accounts.map((acc, i) => [
      i + 1,
      acc.first_name,
      acc.last_name,
      acc.email,
      acc.is_active ? strings.statusFilter.active : strings.statusFilter.inactive,
      acc.force_password_reset ? strings.excel.yes : strings.excel.no,
      new Date(acc.created_at).toLocaleDateString("en-GB"),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 28 }, { wch: 12 }, { wch: 20 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.excel.sheetName);
  XLSX.writeFile(wb, `admin-accounts-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
