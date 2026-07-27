import { createPortal } from "react-dom";
import { dashboardStrings as strings } from "../Dashboard.strings";
import { formatDetailValue } from "../helpers";
import type { MetricDetail, MetricKey } from "../types";

interface MetricDetailModalProps {
  selectedMetric: MetricKey;
  metricDetail: MetricDetail | null;
  metricLoading: boolean;
  metricError: string | null;
  onClose: () => void;
}

export function MetricDetailModal({ selectedMetric, metricDetail, metricLoading, metricError, onClose }: MetricDetailModalProps) {
  const t = strings.detailModal;
  return createPortal(
    <div className="dashboard-detail-backdrop" onMouseDown={onClose}>
      <section
        className="dashboard-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="dashboard-detail-header">
          <div>
            <span className="page-eyebrow">{t.eyebrow}</span>
            <h2 id="dashboard-detail-title">{metricDetail?.title ?? strings.metricTitles[selectedMetric]}</h2>
            {metricDetail && <p>{metricDetail.description}</p>}
          </div>
          <button type="button" className="dashboard-detail-close" onClick={onClose} aria-label={t.closeLabel} title={t.closeTitle} autoFocus>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-close-icon">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div className="dashboard-detail-body">
          {metricLoading && <div className="dashboard-detail-state">{t.loadingDetails}</div>}
          {metricError && <div className="dashboard-detail-state error-text">{metricError}</div>}
          {metricDetail && metricDetail.items.length === 0 && <div className="dashboard-detail-state">{metricDetail.empty_message}</div>}
          {metricDetail && metricDetail.items.length > 0 && (
            <div className="dashboard-records-list">
              <div className="records-count-bar">
                <div className="records-count-left">
                  <span className="records-count-indicator" />
                  <span className="records-count-label">{t.totalRecords}</span>
                </div>
                <span className="records-count-badge">{metricDetail.items.length}</span>
              </div>

              {metricDetail.items.map((item) => (
                <article className="dashboard-record-card" key={`${metricDetail.metric}-${item.id}`}>
                  <div className="record-card-top">
                    <div className="record-identity">
                      <div className="record-title-group">
                        <h3 className="record-title">{item.title}</h3>
                        {item.status_label && (
                          <span className="record-status-pill" data-tone={item.status_tone}>
                            <span className="status-dot" />
                            {item.status_label}
                          </span>
                        )}
                      </div>
                      {item.subtitle && <p className="record-subtitle">{item.subtitle}</p>}
                    </div>

                    {item.value !== null && (
                      <div className="record-value-box">
                        <strong className="record-value-num">{formatDetailValue(item.value, item.value_type, item.currency)}</strong>
                        {item.value_label && <span className="record-value-lbl">{item.value_label}</span>}
                      </div>
                    )}
                  </div>

                  {item.metadata.length > 0 && (
                    <div className="record-metadata-grid">
                      {item.metadata.map((entry) => (
                        <div className="metadata-chip" key={`${item.id}-${entry.label}`}>
                          <span className="meta-chip-label">{entry.label}</span>
                          <span className="meta-chip-value">{formatDetailValue(entry.value, entry.value_type, entry.currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
