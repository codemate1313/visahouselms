import type { FormEvent } from "react";
import type { ExamModule, ExamModulePart } from "@/api/types";
import { moduleEditorStrings as strings } from "../ModuleEditor.strings";
import { Button } from "@/components/ui/Button/Button";

interface BulkImportFormProps {
  module: ExamModule;
  part: ExamModulePart;
  importFile: File | null;
  onImportFileChange: (file: File | null) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
}

export function BulkImportForm({ module, part, importFile, onImportFileChange, busy, onSubmit }: BulkImportFormProps) {
  const t = strings.bulkImport;
  return (
    <section className="authoring-panel">
      <div className="panel-title">
        <div>
          <h2>{t.heading(part.title)}</h2>
        </div>
      </div>
      <p className="hint">{t.hint(module.title, part.title)}</p>
      <form className="import-upload" onSubmit={onSubmit}>
        <input type="file" accept=".pdf,.csv,application/pdf,text/csv" onChange={(event) => onImportFileChange(event.target.files?.[0] ?? null)} required />
        <Button type="submit" disabled={busy || !importFile}>
          {busy ? t.extracting : t.extract}
        </Button>
      </form>
    </section>
  );
}
