import { Button, Modal } from "@/components/ui";
import type { ImportResult } from "../types";
import { instituteMembersStrings as strings } from "../InstituteMembers.strings";
import { Icon } from "@/components/icons";

interface ImportResultModalProps {
  result: ImportResult;
  onClose: () => void;
  onDownloadCredentials: () => void;
}

export function ImportResultModal({ result, onClose, onDownloadCredentials }: ImportResultModalProps) {
  const t = strings.importModal;
  const invalidEmails = result.invalid_emails ?? result.skipped.filter((item) => item.invalid_email);
  const invalidRows = new Set(invalidEmails.map((item) => item.row));
  const otherSkipped = result.skipped.filter((item) => !item.invalid_email && !invalidRows.has(item.row));

  return (
    <Modal
      open
      onClose={onClose}
      title={t.title}
      size="lg"
      className="import-result-modal"
      actions={
        <>
          {result.created.length > 0 && (
            <Button variant="secondary" onClick={onDownloadCredentials}>
              {t.downloadCsv}
            </Button>
          )}
          <Button onClick={onClose}>{t.done}</Button>
        </>
      }
    >
      <p className="import-result-summary">
        {t.summary(result.summary.created, result.summary.skipped, result.summary.remaining_slots)}
      </p>

      {invalidEmails.length > 0 && (
        <section className="import-invalid-email-notice" aria-labelledby="invalid-email-heading">
          <div className="import-invalid-email-heading">
            <Icon name="warning" />
            <div>
              <h3 id="invalid-email-heading">{t.invalidEmailsHeading}</h3>
              <p>{t.invalidEmailsMessage}</p>
            </div>
          </div>
          <div className="table-wrap compact-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.row}</th>
                  <th>{t.email}</th>
                  <th>{t.reason}</th>
                </tr>
              </thead>
              <tbody>
                {invalidEmails.map((item) => (
                  <tr key={`invalid-${item.row}-${item.email ?? "missing"}`}>
                    <td>{item.row}</td>
                    <td>{item.email ?? "-"}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result.created.length > 0 && (
        <section className="import-result-section">
          <div className="panel-heading">
            <h3>{t.credentialsHeading}</h3>
          </div>
          <div className="table-wrap compact-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.student}</th>
                  <th>{t.email}</th>
                  <th>{t.temporaryPassword}</th>
                </tr>
              </thead>
              <tbody>
                {result.created.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.first_name} {item.last_name}
                    </td>
                    <td>{item.email}</td>
                    <td>
                      <code>{item.temporary_password}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {otherSkipped.length > 0 && (
        <section className="import-result-section">
          <h3>{invalidEmails.length > 0 ? t.otherSkippedRowsHeading : t.skippedRowsHeading}</h3>
          <div className="table-wrap compact-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t.row}</th>
                  <th>{t.email}</th>
                  <th>{t.reason}</th>
                </tr>
              </thead>
              <tbody>
                {otherSkipped.map((item) => (
                  <tr key={`${item.row}-${item.email}`}>
                    <td>{item.row}</td>
                    <td>{item.email ?? "-"}</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Modal>
  );
}
