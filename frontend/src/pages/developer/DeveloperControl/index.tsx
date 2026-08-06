import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { confirmAction } from "@/components/confirmDialog";
import { Button, PageHeader, Textarea } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import "./DeveloperControl.css";

const developerSlug = import.meta.env.VITE_DEVELOPER_ACCESS_SLUG || "vh-control-9f4c2a";

interface MaintenanceState {
  maintenance: boolean;
  message: string | null;
}

/**
 * The maintenance kill switch.
 *
 * Closing the site turns away every role except the developer, so this screen
 * stays reachable to turn it back on - the switch cannot lock out the person
 * holding it. Both directions are confirmed and audited server-side.
 */
export function DeveloperControl() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  const [state, setState] = useState<MaintenanceState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient
      .get<MaintenanceState>(`/developer/${developerSlug}/maintenance`)
      .then(({ data }) => {
        setState(data);
        setMessage(data.message ?? "");
      })
      .catch((err: unknown) => showError(extractErrorMessage(err, "Could not load site state.")));
  }, [showError]);

  async function apply(enabled: boolean) {
    if (enabled) {
      const ok = await confirmAction(
        "Close the entire platform? Every institute, instructor and student will be locked out until you reopen it. You will still have access.",
        { title: "Close the site", confirmText: "Close the site", variant: "danger" },
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      const { data } = await apiClient.put<MaintenanceState>(`/developer/${developerSlug}/maintenance`, {
        enabled,
        message: enabled ? message.trim() || null : null,
      });
      setState(data);
      showSuccess(enabled ? "The site is now closed for maintenance." : "The site is open again.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not change site state."));
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <p>Loading…</p>;

  return (
    <div className="developer-control">
      <PageHeader
        eyebrow="Platform"
        title="Site control"
        subtitle="Open or close the entire platform. Closing it turns everyone away except you."
      />

      <section className={`form-card wide site-state-card${state.maintenance ? " is-closed" : " is-open"}`}>
        <div className="site-state-head">
          <span className={`site-state-dot${state.maintenance ? " is-closed" : ""}`} aria-hidden="true" />
          <div>
            <strong className="site-state-title">
              {state.maintenance ? "The site is closed" : "The site is open"}
            </strong>
            <p className="hint">
              {state.maintenance
                ? "Everyone except the developer role is being shown the maintenance notice."
                : "All institutes, instructors and students can use the platform normally."}
            </p>
          </div>
        </div>

        {!state.maintenance && (
          <div className="site-state-field">
            <label htmlFor="maintenance-message">Notice shown to visitors (optional)</label>
            <Textarea
              id="maintenance-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={280}
              rows={3}
              placeholder="We're carrying out scheduled maintenance and will be back shortly."
            />
          </div>
        )}

        <div className="site-state-actions">
          {state.maintenance ? (
            <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={() => apply(false)}>
              Reopen the site
            </Button>
          ) : (
            <Button type="button" variant="danger" loading={busy} disabled={busy} onClick={() => apply(true)}>
              Close the site
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
