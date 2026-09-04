import { useEffect, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Button, Input, PageHeader, Textarea } from "@/components/ui";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { confirmAction } from "@/components/confirmDialog";
import { DEVELOPER_ACCESS_SLUG } from "@/config/developerAccess";
import { useToastStore } from "@/store/toastStore";
import { StaticOtpTab } from "@/pages/super-admin/DeveloperSettings/components/StaticOtpTab";
import "./DeveloperControl.css";

const developerSlug = DEVELOPER_ACCESS_SLUG;

interface MaintenanceState {
  maintenance: boolean;
  message: string | null;
  password_set: boolean;
  read_only?: boolean;
}

/**
 * The maintenance kill switch, gated by a dedicated shutdown password.
 *
 * Closing the site turns away every role except the developer, so this screen
 * stays reachable to reopen it. The password is a second secret beyond the
 * login - closing the whole platform should not be one careless click - and it
 * is stored server-side only as a high-cost bcrypt hash.
 */
export function DeveloperControl() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  const [state, setState] = useState<MaintenanceState | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Close flow.
  const [closePassword, setClosePassword] = useState("");

  // Password set/change flow.
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    apiClient
      .get<MaintenanceState>(`/developer/${developerSlug}/maintenance`)
      .then(({ data }) => {
        setState(data);
        setMessage(data.message ?? "");
        // With no password yet, the site cannot be closed - lead with setting one.
        setShowPasswordForm(!data.password_set);
      })
      .catch((err: unknown) => showError(extractErrorMessage(err, "Could not load site state.")));
  }, [showError]);

  async function savePassword() {
    if (newPassword.trim().length < 8) {
      showError("The shutdown password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await apiClient.put<MaintenanceState>(`/developer/${developerSlug}/maintenance/password`, {
        new_password: newPassword.trim(),
        current_password: currentPassword.trim() || undefined,
      });
      setState(data);
      setNewPassword("");
      setCurrentPassword("");
      setShowPasswordForm(false);
      showSuccess("Shutdown password saved.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not save the shutdown password."));
    } finally {
      setBusy(false);
    }
  }

  async function close() {
    if (!closePassword.trim()) {
      showError("Enter the shutdown password to close the site.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await apiClient.put<MaintenanceState>(`/developer/${developerSlug}/maintenance`, {
        enabled: true,
        message: message.trim() || null,
        password: closePassword.trim(),
      });
      setState(data);
      setClosePassword("");
      showSuccess("The site is now closed for maintenance.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not close the site."));
    } finally {
      setBusy(false);
    }
  }

  async function reopen() {
    setBusy(true);
    try {
      const { data } = await apiClient.put<MaintenanceState>(`/developer/${developerSlug}/maintenance`, {
        enabled: false,
      });
      setState(data);
      showSuccess("The site is open again.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not reopen the site."));
    } finally {
      setBusy(false);
    }
  }

  async function toggleReadOnly(enabled: boolean) {
    setBusy(true);
    try {
      const { data } = await apiClient.put<MaintenanceState>(`/developer/${developerSlug}/read-only`, { enabled });
      setState((current) => ({ ...(current as MaintenanceState), ...data }));
      showSuccess(enabled ? "Read-only mode is on." : "Read-only mode is off.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not change read-only mode."));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const ok = await confirmAction(
      "Clear the shutdown password? You'll need to set a new one before the site can be closed again. Owner only.",
      { title: "Reset shutdown password", confirmText: "Clear it", variant: "danger" },
    );
    if (!ok) return;
    setBusy(true);
    try {
      const { data } = await apiClient.delete<MaintenanceState>(`/developer/${developerSlug}/maintenance/password`);
      setState((current) => ({ ...(current as MaintenanceState), ...data }));
      setShowPasswordForm(true);
      showSuccess("Shutdown password cleared. Set a new one below.");
    } catch (err: unknown) {
      showError(extractErrorMessage(err, "Could not reset the shutdown password."));
    } finally {
      setBusy(false);
    }
  }

  if (!state) return <RouteLoadingState />;

  return (
    <div className="developer-control">
      <PageHeader
        eyebrow="Platform"
        title="Site control"
        subtitle="Open or close the entire platform. Closing it turns everyone away except you, and requires the shutdown password."
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

        {state.maintenance ? (
          <div className="site-state-actions">
            <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={reopen}>
              Reopen the site
            </Button>
          </div>
        ) : (
          <>
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

            {state.password_set ? (
              <div className="site-state-field">
                <label htmlFor="close-password">Shutdown password</label>
                <Input
                  id="close-password"
                  type="password"
                  value={closePassword}
                  onChange={(event) => setClosePassword(event.target.value)}
                  placeholder="Required to close the site"
                  autoComplete="off"
                />
              </div>
            ) : (
              <p className="hint site-no-password">
                Set a shutdown password below before the site can be closed.
              </p>
            )}

            <div className="site-state-actions">
              <Button
                type="button"
                variant="danger"
                loading={busy}
                disabled={busy || !state.password_set}
                onClick={close}
              >
                Close the site
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="form-card wide site-state-card">
        <div className="site-state-head">
          <span className={`site-state-dot${state.read_only ? " is-closed" : ""}`} aria-hidden="true" />
          <div>
            <strong className="site-state-title">Read-only mode {state.read_only ? "is on" : "is off"}</strong>
            <p className="hint">
              A lighter switch than shutdown: the site stays viewable, but no one except you can change anything.
            </p>
          </div>
        </div>
        <div className="site-state-actions">
          {state.read_only ? (
            <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={() => toggleReadOnly(false)}>
              Turn read-only off
            </Button>
          ) : (
            <Button type="button" variant="secondary" loading={busy} disabled={busy} onClick={() => toggleReadOnly(true)}>
              Turn read-only on
            </Button>
          )}
        </div>
      </section>

      <section className="form-card wide site-password-card">
        <div className="site-password-head">
          <div>
            <strong className="site-state-title">Shutdown password</strong>
            <p className="hint">
              {state.password_set
                ? "A shutdown password is set. Closing the site requires it."
                : "No shutdown password yet. Set one to enable the kill switch."}
            </p>
          </div>
          {state.password_set && !showPasswordForm && (
            <div className="ops-inline">
              <Button type="button" variant="secondary" onClick={() => setShowPasswordForm(true)}>
                Change
              </Button>
              <Button type="button" variant="text" disabled={busy} onClick={resetPassword}>
                Forgot it?
              </Button>
            </div>
          )}
        </div>

        {showPasswordForm && (
          <div className="site-password-form">
            {state.password_set && (
              <div className="site-state-field">
                <label htmlFor="current-password">Current password</label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="off"
                />
              </div>
            )}
            <div className="site-state-field">
              <label htmlFor="new-password">New password</label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
              />
            </div>
            <div className="site-state-actions">
              <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={savePassword}>
                Save password
              </Button>
              {state.password_set && (
                <Button type="button" variant="text" disabled={busy} onClick={() => setShowPasswordForm(false)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section style={{ marginTop: "24px" }}>
        <StaticOtpTab />
      </section>
    </div>
  );
}
