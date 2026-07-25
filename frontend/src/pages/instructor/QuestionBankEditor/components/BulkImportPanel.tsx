import type { FormEvent } from "react";
import { questionBankEditorStrings as strings } from "../QuestionBankEditor.strings";

interface BulkImportPanelProps {
  importFile: File | null;
  onImportFileChange: (file: File | null) => void;
  importing: boolean;
  onSubmit: (event: FormEvent) => void;
  onDownloadTemplate: () => void;
}

export function BulkImportPanel({ importFile, onImportFileChange, importing, onSubmit, onDownloadTemplate }: BulkImportPanelProps) {
  const t = strings.bulkImport;
  return (
    <section className="authoring-panel">
      <div className="panel-title">
        <div>
          <span className="phase-chip">{t.eyebrow}</span>
          <h2>{t.heading}</h2>
        </div>
        <button type="button" className="secondary-button compact-button" onClick={onDownloadTemplate}>
          {t.csvTemplate}
        </button>
      </div>
      <p className="hint">{t.hint}</p>
      <form className="import-upload" onSubmit={onSubmit}>
        <input
          id="question-import-file"
          type="file"
          accept=".pdf,.csv,application/pdf,text/csv"
          onChange={(event) => onImportFileChange(event.target.files?.[0] ?? null)}
          required
        />
        <button type="submit" disabled={!importFile || importing}>
          {importing ? t.extracting : t.extractAndReview}
        </button>
      </form>
    </section>
  );
}
