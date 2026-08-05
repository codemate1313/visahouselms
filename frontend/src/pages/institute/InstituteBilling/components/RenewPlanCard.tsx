import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import { Badge, Button, Input } from "@/components/ui";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";
import { formatCurrencyAmount } from "@/utils/currency";
import { formatDate } from "@/utils/date";
import { loadRazorpayScript, openRazorpayCheckout } from "@/utils/razorpay";
import { instituteBillingStrings as strings } from "../InstituteBilling.strings";
import type { RenewalOption, RenewalOptions, RenewalOrder } from "../types";

interface RenewPlanCardProps {
  /** Refetches subscription and payment history once a renewal lands. */
  onRenewed: () => void;
}

/**
 * Self-service renewal, with the plan choice bounded server-side.
 *
 * An institute may buy its next term on a plan it has held before - so renewing
 * what you already pay for is one click - or on a published tier, so outgrowing
 * a plan does not need a support ticket. The pricing shown here is whatever the
 * server quoted; nothing about the amount is computed in the browser.
 *
 * Either way the new term starts at the current expiry rather than today, so
 * renewing early costs nothing in unused days.
 */
export function RenewPlanCard({ onRenewed }: RenewPlanCardProps) {
  const t = strings.renew;
  const user = useAuthStore((state) => state.user);
  const showSuccess = useToastStore((state) => state.showSuccess);
  const showError = useToastStore((state) => state.showError);

  const [data, setData] = useState<RenewalOptions | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [busy, setBusy] = useState<null | "paying" | "verifying">(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<RenewalOptions>("/institute/renewal-options")
      .then((response) => {
        setData(response.data);
        // A first purchase has no current plan to fall back on, so the cheapest
        // option leads rather than leaving the card with nothing selected.
        setSelectedId(response.data.current_plan_id ?? response.data.options[0]?.plan_id ?? null);
        if (response.data.options.some((option) => option.online_payment_available)) {
          void loadRazorpayScript();
        }
      })
      // No options means nothing is renewable - the card hides itself rather
      // than shouting about it.
      .catch(() => setData(null));
  }, []);

  const selected = useMemo(
    () => data?.options.find((option) => option.plan_id === selectedId) ?? null,
    [data, selectedId],
  );

  const held = data?.options.filter((option) => option.held_before) ?? [];
  const catalogue = data?.options.filter((option) => !option.held_before) ?? [];

  function choose(option: RenewalOption) {
    if (!option.is_available || busy !== null) return;
    setSelectedId(option.plan_id);
    setError(null);
    setCouponCode("");
  }

  function finish(planName: string) {
    setBusy(null);
    setCouponCode("");
    // Nothing was renewed if this was the institute's first term.
    const activating = Boolean(data?.is_activation);
    showSuccess(
      activating ? t.activationSuccess(planName) : t.success(planName),
      activating ? t.activationSuccessTitle : t.successTitle,
    );
    onRenewed();
  }

  async function renew() {
    if (!selected) return;
    setError(null);

    if (selected.online_payment_available && !(await loadRazorpayScript())) {
      setError(t.blocked);
      return;
    }

    setBusy("paying");
    let order: RenewalOrder;
    try {
      const response = await apiClient.post<RenewalOrder>("/institute/subscription/renew-order", {
        plan_id: selected.plan_id,
        coupon_code: couponCode.trim() || undefined,
      });
      order = response.data;
    } catch (err: unknown) {
      setBusy(null);
      setError(extractErrorMessage(err, strings.errors.renew));
      return;
    }

    // No charge, or no gateway configured: the server already booked the term,
    // so there is nothing left to confirm.
    if (!order.online_payment || !order.order_id || !order.key_id || !order.payment_id) {
      finish(selected.plan_name);
      return;
    }

    const paymentId = order.payment_id;
    openRazorpayCheckout({
      keyId: order.key_id,
      orderId: order.order_id,
      amount: order.amount ?? 0,
      currency: order.currency || selected.currency,
      // Printed on the Razorpay sheet and the receipt.
      description: `${selected.plan_name} ${data?.is_activation ? "subscription" : "renewal"}`,
      prefillName: `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim(),
      prefillEmail: user?.email ?? "",
      onSuccess: async (response) => {
        setBusy("verifying");
        try {
          await apiClient.post(`/institute/payments/${paymentId}/verify-renewal`, response);
          finish(selected.plan_name);
        } catch (err: unknown) {
          setBusy(null);
          showError(extractErrorMessage(err, strings.errors.verify), strings.errors.renew);
        }
      },
      onDismiss: () => setBusy(null),
      onFailure: (message) => {
        setBusy(null);
        showError(message, strings.errors.renew);
      },
    });
  }

  if (!data || data.options.length === 0) return null;

  function renderOption(option: RenewalOption) {
    const isSelected = option.plan_id === selectedId;
    return (
      <button
        type="button"
        key={option.plan_id}
        className={`renew-option${isSelected ? " is-selected" : ""}${option.is_available ? "" : " is-unavailable"}`}
        onClick={() => choose(option)}
        disabled={!option.is_available || busy !== null}
        aria-pressed={isSelected}
      >
        <span className="renew-option-head">
          <strong className="renew-option-name">{option.plan_name}</strong>
          {option.is_current ? (
            <Badge tone="green">{t.currentBadge}</Badge>
          ) : !option.is_available ? (
            <Badge tone="gray">{t.unavailableBadge}</Badge>
          ) : option.held_before ? (
            <Badge tone="blue">{t.heldBadge}</Badge>
          ) : null}
        </span>

        <span className="renew-option-price">
          {option.requires_payment ? formatCurrencyAmount(option.final_amount, option.currency) : t.free}
          <small>{t.perTerm(option.duration_days)}</small>
        </span>

        <span className="renew-option-seats">{t.seats(option.student_limit, option.staff_limit)}</span>
        {option.description && <span className="renew-option-description">{option.description}</span>}
      </button>
    );
  }

  const hasGst = (selected?.gst_percentage ?? 0) > 0;

  return (
    <section className="form-card wide renew-plan-card">
      <span className="renew-plan-eyebrow">{data.is_activation ? t.activationEyebrow : t.eyebrow}</span>
      <h2 className="renew-plan-title">{data.is_activation ? t.activationTitle : t.title}</h2>
      <p className="hint renew-plan-description">
        {data.is_activation ? t.activationDescription : t.description}
      </p>

      {held.length > 0 && (
        <>
          <h3 className="renew-group-heading">{t.yourPlansHeading}</h3>
          <div className="renew-option-grid">{held.map(renderOption)}</div>
        </>
      )}

      {catalogue.length > 0 && (
        <>
          {/* On a first purchase there is nothing to contrast against, so the
              "other tiers" framing would be meaningless. */}
          <h3 className="renew-group-heading">
            {data.is_activation && held.length === 0 ? t.availableHeading : t.catalogueHeading}
          </h3>
          <div className="renew-option-grid">{catalogue.map(renderOption)}</div>
        </>
      )}

      {selected && (
        <>
          <div className="renew-plan-grid">
            <div className="renew-plan-fact">
              <span className="renew-plan-fact-label">{t.planLabel}</span>
              <strong className="renew-plan-fact-value">{selected.plan_name}</strong>
            </div>
            <div className="renew-plan-fact">
              <span className="renew-plan-fact-label">
                {selected.requires_payment ? t.amountLabel : t.amountLabelFree}
              </span>
              <strong className="renew-plan-fact-value is-amount">
                {selected.requires_payment
                  ? formatCurrencyAmount(selected.final_amount, selected.currency)
                  : t.freeAmount}
              </strong>
            </div>
            <div className="renew-plan-fact">
              <span className="renew-plan-fact-label">{t.termLabel}</span>
              <strong className="renew-plan-fact-value">
                {t.termValue(formatDate(selected.new_starts_at), formatDate(selected.new_expires_at))}
              </strong>
            </div>
          </div>

          <p className="hint renew-plan-term-note">
            {data.is_activation ? t.activationTermNote(selected.duration_days) : t.termNote(selected.duration_days)}
          </p>
          {/* Only meaningful against a term that already exists - on a first
              purchase there is nothing to run down first. */}
          {!data.is_activation && !selected.is_current && (
            <p className="hint renew-plan-term-note">{t.switchNotice(selected.plan_name)}</p>
          )}

          {selected.requires_payment && (
            <>
              <div className="renew-plan-breakdown">
                <div className="renew-plan-breakdown-row">
                  <span>{t.basePrice}</span>
                  <span>{formatCurrencyAmount(selected.base_amount, selected.currency)}</span>
                </div>
                {hasGst && (
                  <div className="renew-plan-breakdown-row">
                    <span>{t.gst(selected.gst_percentage, selected.gst_tax_type)}</span>
                    <span>+{formatCurrencyAmount(selected.gst_amount, selected.currency)}</span>
                  </div>
                )}
                <div className="renew-plan-breakdown-row is-total">
                  <span>{t.total}</span>
                  <span>{formatCurrencyAmount(selected.final_amount, selected.currency)}</span>
                </div>
              </div>

              <label className="renew-plan-coupon">
                <span className="renew-plan-fact-label">{t.couponLabel}</span>
                <Input
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  placeholder={t.couponPlaceholder}
                  disabled={busy !== null}
                />
              </label>
            </>
          )}

          <p className="hint renew-plan-gateway-note">
            {!selected.requires_payment
              ? t.freeNotice
              : selected.online_payment_available
                ? t.gatewayNotice
                : t.offlineNotice}
          </p>

          {error && <p className="error-text">{error}</p>}

          <div className="form-actions">
            <Button type="button" variant="primary" onClick={renew} loading={busy !== null} disabled={busy !== null}>
              {busy === "verifying"
                ? t.verifying
                : busy === "paying"
                  ? selected.requires_payment
                    ? t.paying
                    : t.extending
                  : !selected.requires_payment
                    ? t.extend
                    : selected.online_payment_available
                      ? (data.is_activation ? t.payActivation : t.pay)(
                          formatCurrencyAmount(selected.final_amount, selected.currency),
                        )
                      : data.is_activation
                        ? t.payManualActivation
                        : t.payManual}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
