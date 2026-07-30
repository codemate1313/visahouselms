import { useId } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import "./AgreementAttachments.css";

export interface AgreementAttachment {
  name: string;
  download_url: string;
}

interface AttachmentFieldProps {
  description: string;
  existing: AgreementAttachment | null;
  file: File | null;
  icon: "filePdf" | "payment";
  label: string;
  onChange: (file: File | null) => void;
  onDownload: (attachment: AgreementAttachment) => void;
  onRemoveExisting: () => void;
}

function AttachmentField({
  description,
  existing,
  file,
  icon,
  label,
  onChange,
  onDownload,
  onRemoveExisting,
}: AttachmentFieldProps) {
  const inputId = useId();
  const displayedName = file?.name ?? existing?.name;

  return (
    <div className="agreement-attachment-field">
      <div className="agreement-attachment-icon" aria-hidden="true">
        <Icon name={icon} />
      </div>
      <div className="agreement-attachment-content">
        <strong>{label}</strong>
        <small>{description}</small>
        {displayedName && (
          <span className="agreement-attachment-name" title={displayedName}>
            {displayedName}
          </span>
        )}
      </div>
      <div className="agreement-attachment-actions">
        <input
          id={inputId}
          type="file"
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
          hidden
        />
        <label className="agreement-attachment-upload" htmlFor={inputId}>
          <Icon name={displayedName ? "edit" : "plus"} />
          <span>{displayedName ? "Replace" : "Choose file"}</span>
        </label>
        {existing && !file && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Icon name="download" />}
            onClick={() => onDownload(existing)}
          >
            Download
          </Button>
        )}
        {file && (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Clear
          </Button>
        )}
        {existing && !file && (
          <Button
            variant="danger"
            size="sm"
            leftIcon={<Icon name="trash" />}
            onClick={onRemoveExisting}
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

interface AgreementAttachmentsProps {
  agreementDocument: AgreementAttachment | null;
  agreementDocumentFile: File | null;
  onAgreementDocumentChange: (file: File | null) => void;
  onDownload: (attachment: AgreementAttachment) => void;
  onPaymentProofChange: (file: File | null) => void;
  onRemoveAgreementDocument: () => void;
  onRemovePaymentProof: () => void;
  paymentProof: AgreementAttachment | null;
  paymentProofFile: File | null;
}

export function AgreementAttachments({
  agreementDocument,
  agreementDocumentFile,
  onAgreementDocumentChange,
  onDownload,
  onPaymentProofChange,
  onRemoveAgreementDocument,
  onRemovePaymentProof,
  paymentProof,
  paymentProofFile,
}: AgreementAttachmentsProps) {
  return (
    <div className="agreement-attachments">
      <div className="agreement-attachments-heading">
        <h3>Supporting documents</h3>
        <p>Optional files, up to 20 MB each. All file formats are accepted.</p>
      </div>
      <div className="agreement-attachments-grid">
        <AttachmentField
          label="Agreement document"
          description="Signed agreement, contract, purchase order, or related file."
          icon="filePdf"
          file={agreementDocumentFile}
          existing={agreementDocument}
          onChange={onAgreementDocumentChange}
          onDownload={onDownload}
          onRemoveExisting={onRemoveAgreementDocument}
        />
        <AttachmentField
          label="Proof of payment"
          description="Receipt, bank confirmation, screenshot, or other payment evidence."
          icon="payment"
          file={paymentProofFile}
          existing={paymentProof}
          onChange={onPaymentProofChange}
          onDownload={onDownload}
          onRemoveExisting={onRemovePaymentProof}
        />
      </div>
    </div>
  );
}
