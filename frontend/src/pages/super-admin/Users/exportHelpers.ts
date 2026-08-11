import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { DirectoryRole, DirectoryUser } from "@/api/types";
import { usersStrings as strings } from "./Users.strings";
import { formatDate } from "@/utils/date";

/**
 * Exports the rows currently on screen. The institute column is included only
 * for tenant-scoped tabs, matching what the table itself shows.
 */
function fileStem(role: DirectoryRole): string {
  return `${strings.tabs[role].toLowerCase().replace(/\s+/g, "-")}-${new Date()
    .toISOString()
    .slice(0, 10)}`;
}

function statusLabel(user: DirectoryUser): string {
  if (user.deleted_at) return strings.statusFilter.deleted;
  return user.is_active ? strings.statusFilter.active : strings.statusFilter.inactive;
}

export function exportUsersPDF(users: DirectoryUser[], role: DirectoryRole, showInstitute: boolean) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.setFillColor(185, 28, 43);
  doc.rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`Language CERT — ${strings.tabs[role]}`, 14, 12);

  const head = showInstitute
    ? ["#", "Name", "Email", "Institute", "Status", "Created"]
    : ["#", "Name", "Email", "Status", "Created"];

  autoTable(doc, {
    startY: 24,
    head: [head],
    body: users.map((user, index) => {
      const created = formatDate(user.created_at);
      const name = `${user.first_name} ${user.last_name}`;
      return showInstitute
        ? [index + 1, name, user.email, user.institute_name ?? "—", statusLabel(user), created]
        : [index + 1, name, user.email, statusLabel(user), created];
    }),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
  });

  doc.save(`${fileStem(role)}.pdf`);
}

export function exportUsersExcel(users: DirectoryUser[], role: DirectoryRole, showInstitute: boolean) {
  const header = showInstitute
    ? ["#", "First Name", "Last Name", "Email", "Institute", "Status", "Password Reset", "Password Changed", "Created"]
    : ["#", "First Name", "Last Name", "Email", "Status", "Password Reset", "Password Changed", "Created"];

  const rows: (string | number)[][] = users.map((user, index) => {
    const created = formatDate(user.created_at);
    const reset = user.force_password_reset ? "Yes" : "No";
    const changedAt = user.password_changed_at ?? user.last_password_change?.at ?? null;
    const changed = changedAt
      ? formatDate(changedAt)
      : strings.passwordTrail.never;
    return showInstitute
      ? [index + 1, user.first_name, user.last_name, user.email, user.institute_name ?? "—", statusLabel(user), reset, changed, created]
      : [index + 1, user.first_name, user.last_name, user.email, statusLabel(user), reset, changed, created];
  });

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"] = header.map((_, index) => ({ wch: index === 0 ? 5 : 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, strings.tabs[role].slice(0, 31));
  XLSX.writeFile(wb, `${fileStem(role)}.xlsx`);
}
