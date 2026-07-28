import { Button } from "@/components/ui";
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
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card import-result-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-heading">
          <div>
            <h2>{t.title}</h2>
            <p>{t.summary(result.summary.created, result.summary.skipped, result.summary.remaining_slots)}</p>
          </div>
          <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
            <Icon name="cross" />
          </button>
        </div>
        {result.created.length > 0 && (
          <div className="import-result-section">
            <div className="panel-heading">
              <h3>{t.credentialsHeading}</h3>
              <Button size="sm" onClick={onDownloadCredentials}>
                {t.downloadCsv}
              </Button>
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
          </div>
        )}
        {result.skipped.length > 0 && (
          <div className="import-result-section">
            <h3>{t.skippedRowsHeading}</h3>
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
                  {result.skipped.map((item) => (
                    <tr key={`${item.row}-${item.email}`}>
                      <td>{item.row}</td>
                      <td>{item.email ?? "-"}</td>
                      <td>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
