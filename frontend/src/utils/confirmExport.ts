import { confirmAction } from "@/components/confirmDialog";

type ExportFormat = "pdf" | "excel";

const formatLabels: Record<ExportFormat, string> = {
  pdf: "PDF",
  excel: "Excel",
};

export async function confirmExport(format: ExportFormat, subject: string): Promise<boolean> {
  const label = formatLabels[format];
  return confirmAction(`Generate the ${label} export for ${subject}?`, {
    title: `${label} Export`,
    confirmText: `Generate ${label}`,
    cancelText: "Cancel",
    variant: "primary",
  });
}
