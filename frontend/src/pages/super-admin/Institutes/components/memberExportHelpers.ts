import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatDate } from "@/utils/date";

interface MemberExportRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export function exportMembersPDF(rows: MemberExportRow[], instituteName: string, roleLabel: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  doc.setFillColor(185, 28, 43);
  doc.rect(0, 0, 297, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${instituteName} — ${roleLabel} Report`, 14, 13);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, 220, 13);

  autoTable(doc, {
    startY: 26,
    head: [["#", "Name", "Email", "Status", "Joined"]],
    body: rows.map((row, i) => [
      i + 1,
      `${row.first_name} ${row.last_name}`,
      row.email,
      row.is_active ? "Active" : "Inactive",
      formatDate(row.created_at),
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
    },
  });

  doc.save(`institute-${roleLabel.toLowerCase()}-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function exportMembersExcel(rows: MemberExportRow[], instituteName: string, roleLabel: string) {
  const wsData: (string | number)[][] = [
    ["#", "Name", "Email", "Status", "Joined"],
    ...rows.map((row, i) => [
      i + 1,
      `${row.first_name} ${row.last_name}`,
      row.email,
      row.is_active ? "Active" : "Inactive",
      formatDate(row.created_at),
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 34 }, { wch: 12 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${instituteName.slice(0, 24)} ${roleLabel}`);
  XLSX.writeFile(wb, `institute-${roleLabel.toLowerCase()}-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
