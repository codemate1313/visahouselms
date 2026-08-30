import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { dashboardStrings as strings } from "../Dashboard.strings";
import { formatDetailValue } from "../helpers";
import { MetricBreakdownPanel } from "./MetricBreakdownPanel";
import { IconButton } from "@/components/ui/IconButton/IconButton";
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
  // Which breakdown group the records are narrowed to, if any.
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  // A different metric is a different set of groups, so the old selection
  // cannot survive the switch.
  useEffect(() => setSelectedGroup(null), [selectedMetric]);

  const visibleItems = useMemo(
    () => (selectedGroup === null
      ? metricDetail?.items ?? []
      : (metricDetail?.items ?? []).filter((item) => item.group_key === selectedGroup)),
    [metricDetail, selectedGroup],
  );
  const selectedGroupLabel = metricDetail?.breakdown?.groups.find((group) => group.key === selectedGroup)?.label ?? null;
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
          <IconButton
            className="dashboard-detail-close"
            onClick={onClose}
            label={t.closeLabel}
            title={t.closeTitle}
            autoFocus
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="dashboard-close-icon">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            }
          />
        </header>

        <div className="dashboard-detail-body">
          {metricLoading && <div className="dashboard-detail-state">{t.loadingDetails}</div>}
          {metricError && <div className="dashboard-detail-state error-text">{metricError}</div>}
          {metricDetail && metricDetail.items.length === 0 && <div className="dashboard-detail-state">{metricDetail.empty_message}</div>}

          {metricDetail && metricDetail.items.length > 0 && metricDetail.breakdown && (
            <MetricBreakdownPanel
              breakdown={metricDetail.breakdown}
              selectedKey={selectedGroup}
              onSelectKey={setSelectedGroup}
            />
          )}

          {metricDetail && metricDetail.items.length > 0 && (
            <div className="dashboard-records-list">
              <div className="records-count-bar">
                <div className="records-count-left">
                  <span className="records-count-indicator" />
                  <span className="records-count-label">
                    {selectedGroupLabel ? t.showingFor(selectedGroupLabel) : t.totalRecords}
                  </span>
                </div>
                <span className="records-count-badge">{visibleItems.length}</span>
              </div>

              {visibleItems.map((item) => (
                <article className="dashboard-record-card" key={`${metricDetail.metric}-${item.id}`}>
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

                  <div className="record-metadata-grid">
                    {item.metadata.map((entry) => (
                      <div className="metadata-chip" key={`${item.id}-${entry.label}`}>
                        <span className="meta-chip-label">{entry.label}</span>
                        <span className="meta-chip-value">{formatDetailValue(entry.value, entry.value_type, entry.currency)}</span>
                      </div>
                    ))}
                  </div>

                  {item.value !== null ? (
                    <div className="record-value-box">
                      <strong className="record-value-num">{formatDetailValue(item.value, item.value_type, item.currency)}</strong>
                      {item.value_label && <span className="record-value-lbl">{item.value_label}</span>}
                    </div>
                  ) : (
                    <div className="record-value-box empty" />
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
