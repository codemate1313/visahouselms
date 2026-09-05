import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiClient } from "@/api/client";
import { extractErrorMessage } from "@/api/errors";
import type { DirectoryRole, DirectoryUser } from "@/api/types";
import { MemberFormFields, type MemberFormField } from "@/pages/institute/InstituteMemberForm/components/MemberFormFields";
import { CredentialCreatedView } from "@/pages/institute/InstituteMemberForm/components/CredentialCreatedView";
import { RouteLoadingState } from "@/components/RouteLoadingState";
import { RequiredMark, SearchableSelect } from "@/components/ui";
import type { PlanRow } from "@/pages/super-admin/Plans/types";
import type { MethodRow } from "@/pages/super-admin/Payments/types";

const ROLE_LABELS: Partial<Record<DirectoryRole, string>> = {
  INSTITUTE_ADMIN: "institute admin",
  INST_INSTRUCTOR: "institute staff",
  STUDENT: "student",
};

const ROLE_SLUGS: Partial<Record<DirectoryRole, string>> = {
  INSTITUTE_ADMIN: "institute-admins",
  INST_INSTRUCTOR: "institute-staff",
  STUDENT: "students",
};

interface CreatedPaymentInfo {
  plan_name: string | null;
  final_amount: string;
  currency: string;
  status: string;
  invoice_number: string | null;
  payment_method_name: string | null;
}

export function DirectStudentForm({ portalBasePath = "/super-admin" }: { portalBasePath?: string }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [user, setUser] = useState<DirectoryUser | null>(null);
  const [form, setForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    address: "",
  });
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [createdPayment, setCreatedPayment] = useState<CreatedPaymentInfo | null>(null);

  // A new direct student has no institute, so this is the only place they can
  // be handed a plan without going through self-service checkout - e.g. a
  // walk-in who pays cash at the desk. Purely additive: leaving the toggle off
  // creates the account exactly as before, with no plan and no payment.
  const [assignPlan, setAssignPlan] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [methods, setMethods] = useState<MethodRow[]>([]);
  const [planId, setPlanId] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentReference, setPaymentReference] = useState("");

  useEffect(() => {
    if (!isNew) return;
    apiClient
      .get<PlanRow[]>("/super-admin/plans", { params: { audience: "direct_students" } })
      .then(({ data }) => setPlans(data.filter((plan) => plan.is_active)));
    apiClient
      .get<MethodRow[]>("/super-admin/payment-methods", { params: { active_only: true } })
      .then(({ data }) => setMethods(data));
  }, [isNew]);

  // Cash is the overwhelmingly common case for a plan handed over in person,
  // so it's pre-selected the moment the method list loads - the admin can
  // still switch it (bank transfer, UPI, etc).
  useEffect(() => {
    if (paymentMethodId || methods.length === 0) return;
    const cash = methods.find((method) => method.name.trim().toLowerCase() === "cash");
    if (cash) setPaymentMethodId(String(cash.id));
  }, [methods, paymentMethodId]);

  useEffect(() => {
    if (isNew) return;
    apiClient
      .get<DirectoryUser>(`/super-admin/users/${id}`)
      .then(({ data }) => {
        setUser(data);
        setForm({
          email: data.email,
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number ?? "",
          address: data.address ?? "",
        });
      })
      .catch((err: unknown) => setError(extractErrorMessage(err, "Failed to load user.")))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const roleLabel = isNew ? "student" : user?.role_name ? ROLE_LABELS[user.role_name] ?? "user" : "user";
  const basePath = `${portalBasePath}/users/${user?.role_name ? ROLE_SLUGS[user.role_name] ?? "students" : "students"}`;
  const selectedPlan = plans.find((plan) => String(plan.id) === planId) ?? null;

  // Typed against the shared component's field union rather than this form's
  // own keys. A direct student has no institute and therefore no access window,
  // so the two access fields never render here - but the shared props type has
  // to admit them, and spreading by key stays correct either way.
  function set(field: MemberFormField) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isNew && assignPlan && (!planId || !paymentMethodId)) {
      setError("Choose a plan and a payment method, or turn off plan assignment.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const cleanAmountReceived = amountReceived
          ? Number(String(amountReceived).replace(/,/g, "."))
          : null;
        const { data } = await apiClient.post<{
          temporary_password: string;
          payment?: CreatedPaymentInfo;
        }>("/super-admin/users/students", {
          ...form,
          phone_number: form.phone_number || null,
          address: form.address || null,
          ...(assignPlan
            ? {
                plan_id: Number(planId),
                payment_method_id: Number(paymentMethodId),
                coupon_code: couponCode || null,
                amount_received: cleanAmountReceived,
                gateway_reference: paymentReference || null,
              }
            : {}),
        });
        setCreatedPassword(data.temporary_password);
        setCreatedPayment(data.payment ?? null);
        return;
      }

      await apiClient.patch(`/super-admin/users/${id}`, {
        ...form,
        phone_number: form.phone_number || null,
        address: form.address || null,
      });
      navigate(basePath);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, `Failed to save ${roleLabel}.`));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <RouteLoadingState />;
  if (createdPassword) {
    return (
      <CredentialCreatedView
        isStudent={true}
        email={form.email}
        password={createdPassword}
        onDone={() => navigate(basePath)}
        extra={
          createdPayment && (
            <div className="credential-row">
              <span>Plan</span>
              <code>
                {createdPayment.plan_name} - {createdPayment.currency} {createdPayment.final_amount} (
                {createdPayment.payment_method_name ?? "manual"}, {createdPayment.status}
                {createdPayment.invoice_number ? `, ${createdPayment.invoice_number}` : ""})
              </code>
            </div>
          )
        }
      />
    );
  }

  return (
    <MemberFormFields
      isNew={isNew}
      label={roleLabel}
      form={form}
      saving={saving}
      error={error}
      onFieldChange={set}
      onSubmit={submit}
      onCancel={() => navigate(basePath)}
      extraFields={
        isNew ? (
          <fieldset className="access-window-fieldset">
            <legend>
              <label className="plan-assign-toggle">
                <input
                  type="checkbox"
                  checked={assignPlan}
                  onChange={(event) => setAssignPlan(event.target.checked)}
                />
                {" "}Assign a plan now (cash or other manual payment)
              </label>
            </legend>
            {assignPlan && (
              <>
                <div className="form-grid">
                  <div>
                    <label>Plan<RequiredMark /></label>
                    <SearchableSelect
                      options={plans.map((plan) => ({
                        value: plan.id,
                        label: `${plan.name} - ${plan.currency} ${plan.price}`,
                      }))}
                      value={planId}
                      onChange={(value) => setPlanId(String(value))}
                      searchPlaceholder="Search plans..."
                      placeholder="Select a plan..."
                      className="form-dropdown-select"
                    />
                  </div>
                  <div>
                    <label>Payment method<RequiredMark /></label>
                    <SearchableSelect
                      options={methods.map((method) => ({ value: method.id, label: method.name }))}
                      value={paymentMethodId}
                      onChange={(value) => setPaymentMethodId(String(value))}
                      searchPlaceholder="Search payment methods..."
                      placeholder="Select a payment method..."
                      className="form-dropdown-select"
                    />
                  </div>
                </div>
                <div className="form-grid">
                  <div>
                    <label>Amount received</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={amountReceived}
                      onChange={(e) => {
                        const val = e.target.value.replace(/,/g, ".");
                        if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) setAmountReceived(val);
                      }}
                      placeholder={selectedPlan ? `${selectedPlan.currency} ${selectedPlan.price} (full price)` : "Full price"}
                    />
                  </div>
                  <div>
                    <label>Coupon code</label>
                    <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} />
                  </div>
                  <div>
                    <label>Receipt reference</label>
                    <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="e.g. cash receipt #" />
                  </div>
                </div>
                <p className="muted-text">
                  Leave "Amount received" blank to record the plan's full price as paid. A smaller amount records a
                  partial payment, with the plan activating immediately either way.
                </p>
              </>
            )}
          </fieldset>
        ) : undefined
      }
    />
  );
}
