import { Icon } from "@/components/icons";
import "./ExportButtons.css";

export interface ExportButtonsProps {
  onExportPdf: () => void;
  onExportExcel: () => void;
  pdfLabel?: string;
  excelLabel?: string;
  /** Hide either action for screens that only support one export format. */
  showPdf?: boolean;
  showExcel?: boolean;
  className?: string;
}

/**
 * The PDF + Excel export pair that sits in nearly every dashboard filter bar.
 *
 * These keep their semantic file-type colors (red for PDF, green for Excel)
 * rather than the portal brand color — they identify a format, so they are
 * intentionally exempt from the sidebar-matching rule that governs Button.
 */
export function ExportButtons({
  onExportPdf,
  onExportExcel,
  pdfLabel = "Export as PDF",
  excelLabel = "Export as Excel",
  showPdf = true,
  showExcel = true,
  className = "",
}: ExportButtonsProps) {
  return (
    <div className={`export-btn-group ${className}`.trim()}>
      {showPdf && (
        <button
          type="button"
          className="export-btn export-pdf"
          onClick={onExportPdf}
          data-tooltip={pdfLabel}
          aria-label={pdfLabel}
        >
          <Icon name="filePdf" />
        </button>
      )}
      {showExcel && (
        <button
          type="button"
          className="export-btn export-excel"
          onClick={onExportExcel}
          data-tooltip={excelLabel}
          aria-label={excelLabel}
        >
          <Icon name="spreadsheet" />
        </button>
      )}
    </div>
  );
}
