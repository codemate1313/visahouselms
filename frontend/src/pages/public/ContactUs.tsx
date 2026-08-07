import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiClient, API_BASE_URL } from "@/api/client";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { PublicOrbBackground } from "@/components/publicSite/PublicOrbBackground";
import { PublicCtaBanner } from "@/components/publicSite/PublicCtaBanner";
import { useRevealOnScroll } from "@/components/publicSite/useRevealOnScroll";
import { useAuthStore } from "@/store/authStore";
import { destinationFor } from "@/pages/Login/helpers";
import { useSEO } from "@/hooks/useSEO";
import { useContactSettings } from "./useContactSettings";
import type { LandingPlan, LandingPlansPayload } from "./Plans.types";
import { SegmentedControl } from "@/components/ui";
import { useToastStore } from "@/store/toastStore";
import "@/styles/public/chrome.css";
import "@/styles/public/contact.css";

type FormType = "query" | "partner";
type StatusTone = "ok" | "error";
interface FormStatus {
  message: string;
  tone: StatusTone;
}

const EMPTY_PARTNER_FORM = {
  instName: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  website: "",
  first: "",
  last: "",
  adminEmail: "",
  students: "",
  message: "",
};

const EMPTY_QUERY_FORM = { name: "", email: "", subject: "", message: "" };

function getInitialFormType(search: string): FormType {
  const params = new URLSearchParams(search);
  const form = params.get("form") || params.get("type") || params.get("tab");
  if (params.get("plan") || form === "partner" || form === "institute") return "partner";
  return "query";
}

function getInterestedPlanId(search: string): number | null {
  const params = new URLSearchParams(search);
  const plan = Number(params.get("plan"));
  return Number.isFinite(plan) && plan > 0 ? plan : null;
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function ContactUs() {
  useSEO({ title: "Contact Us", description: "Fill in the form, or use the direct channels below. We reply within one working day." });
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const contactSettings = useContactSettings();
  const goAuth = () => navigate(user ? destinationFor(user) ?? "/" : "/login");
  const rootRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);
  const formSectionRef = useRef<HTMLElement | null>(null);
  useRevealOnScroll(rootRef);

  const [institutePlans, setInstitutePlans] = useState<LandingPlan[]>([]);
  const [formType, setFormType] = useState<FormType>(() => getInitialFormType(location.search));

  useEffect(() => {
    setFormType(getInitialFormType(location.search));
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const form = params.get("form") || params.get("type") || params.get("tab");
    if (params.get("plan") || form === "partner" || form === "institute") {
      const timer = setTimeout(() => {
        if (formSectionRef.current) {
          const y = formSectionRef.current.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
        }
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [location.search]);

  const [partner, setPartner] = useState(EMPTY_PARTNER_FORM);
  const [partnerStatus, setPartnerStatus] = useState<FormStatus | null>(null);
  const [submittingDemo, setSubmittingDemo] = useState(false);

  const [query, setQuery] = useState(EMPTY_QUERY_FORM);
  const [queryStatus, setQueryStatus] = useState<FormStatus | null>(null);
  const [submittingQuery, setSubmittingQuery] = useState(false);

  useEffect(() => {
    apiClient
      .get<LandingPlansPayload>("/plans", { headers: { "X-Skip-Loader": "true" } })
      .then(({ data }) => setInstitutePlans(data.institutes ?? []))
      .catch(() => undefined);
  }, []);

  const interestedPlanId = getInterestedPlanId(location.search);
  const interestedPlanName = interestedPlanId ? institutePlans.find((plan) => Number(plan.id) === interestedPlanId)?.name ?? null : null;

  function switchForm(next: FormType) {
    setFormType(next);
    setPartnerStatus(null);
    setQueryStatus(null);
  }

  function updatePartner<K extends keyof typeof EMPTY_PARTNER_FORM>(key: K, value: string) {
    setPartner((prev) => ({ ...prev, [key]: value }));
  }
  function updateQuery<K extends keyof typeof EMPTY_QUERY_FORM>(key: K, value: string) {
    setQuery((prev) => ({ ...prev, [key]: value }));
  }

  async function submitDemoRequest() {
    if (submittingDemo) return;
    const { instName, email, phone, city, country, website, first, last, adminEmail, students, message } = partner;
    if (!instName.trim() || !email.trim() || !phone.trim() || !first.trim() || !last.trim() || !adminEmail.trim()) {
      const msg = "Please fill in all required fields marked with *.";
      setPartnerStatus({ message: msg, tone: "error" });
      useToastStore.getState().showError(msg);
      return;
    }

    setSubmittingDemo(true);
    setPartnerStatus({ message: "Submitting your application...", tone: "ok" });
    try {
      const response = await fetch(`${API_BASE_URL}/institute-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institute_name: instName.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim(),
          city: city.trim() || null,
          country: country.trim() || null,
          website: website.trim() || null,
          admin_first_name: first.trim(),
          admin_last_name: last.trim(),
          admin_email: adminEmail.trim(),
          expected_students: students.trim() ? Number(students.trim()) : null,
          message: message.trim() || null,
          interested_plan_id: interestedPlanId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = Array.isArray(data.detail) ? data.detail.map((item: { msg?: string }) => item?.msg).filter(Boolean).join(". ") : data.detail;
        throw new Error(detail || "Unable to submit application.");
      }
      const successMsg = "Thanks — your application has been received. We review applications by hand, usually within two working days.";
      setPartnerStatus({ message: successMsg, tone: "ok" });
      useToastStore.getState().showSuccess(successMsg);
      setPartner(EMPTY_PARTNER_FORM);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "We could not submit your application. Please email partners@visahouse.io.";
      setPartnerStatus({ message: errorMsg, tone: "error" });
      useToastStore.getState().showError(errorMsg);
    } finally {
      setSubmittingDemo(false);
    }
  }

  async function submitQueryRequest() {
    if (submittingQuery) return;
    const { name, email, subject, message } = query;
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      const msg = "Please fill in all fields.";
      setQueryStatus({ message: msg, tone: "error" });
      useToastStore.getState().showError(msg);
      return;
    }

    setSubmittingQuery(true);
    setQueryStatus({ message: "Sending your message...", tone: "ok" });
    try {
      const response = await fetch(`${API_BASE_URL}/support/tickets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim(), category: "general" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Unable to submit enquiry.");
      const successMsg = "Thanks. Your enquiry has been received.";
      setQueryStatus({ message: successMsg, tone: "ok" });
      useToastStore.getState().showSuccess(successMsg);
      setQuery(EMPTY_QUERY_FORM);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "We could not submit your enquiry. Please email partners@visahouse.io.";
      setQueryStatus({ message: errorMsg, tone: "error" });
      useToastStore.getState().showError(errorMsg);
    } finally {
      setSubmittingQuery(false);
    }
  }

  const contact = contactSettings?.contact;
  const officeAddressLines = (contact?.office_address ?? "4th Floor, Prestige Meridian,\nMG Road, Bangalore 560001").split("\n");

  return (
    <div className="vh-public" ref={(el) => { rootRef.current = el; }}>
      <PublicOrbBackground />
      <div className="vh-page-content">
        <PublicHeader />

        <section className="vh-page-hero">
          <h1>
            Let us bring Visa House
            <span className="vh-accent"> to your students.</span>
          </h1>
          <p>Fill in the form, or use the direct channels below. We reply within one working day.</p>
        </section>

        <section className="vh-contact-grid vh-reveal" ref={formSectionRef}>
          <div className="vh-apply-form">
            <div className="vh-form-toggle-row">
              <SegmentedControl<FormType>
                ariaLabel="Contact mode"
                value={formType}
                onChange={(val) => switchForm(val)}
                fullWidth
                neverCollapse
                options={[
                  { label: "Contact Us", value: "query" },
                  { label: "Become a Partner", value: "partner" },
                ]}
              />
            </div>

            {formType === "partner" ? (
              <>
                <h2>Become a Partner</h2>
                <p className="vh-apply-form-lede">Tell us about your centre to apply for an institute account.</p>
                {interestedPlanName ? <div className="vh-plan-badge">Interested in: {interestedPlanName} Plan</div> : <div className="vh-plan-badge-spacer" />}

                <div className="vh-form-section-title">About your institute</div>
                <div className="vh-form-grid">
                  <div className="vh-form-field-span2">
                    <label className="vh-form-label">Institute name *</label>
                    <input className="vh-form-input" type="text" placeholder="Meridian Institute" value={partner.instName} onChange={(e) => updatePartner("instName", e.target.value)} />
                  </div>
                  <div>
                    <label className="vh-form-label">Institute contact email *</label>
                    <input className="vh-form-input" type="email" placeholder="info@meridian.com" value={partner.email} onChange={(e) => updatePartner("email", e.target.value)} />
                  </div>
                  <div>
                    <label className="vh-form-label">Phone *</label>
                    <input className="vh-form-input" type="tel" required placeholder="+91 99999 99999" value={partner.phone} onChange={(e) => updatePartner("phone", e.target.value)} />
                  </div>
                  <div>
                    <label className="vh-form-label">City</label>
                    <input className="vh-form-input" type="text" placeholder="Bangalore" value={partner.city} onChange={(e) => updatePartner("city", e.target.value)} />
                  </div>
                  <div>
                    <label className="vh-form-label">Country</label>
                    <input className="vh-form-input" type="text" placeholder="India" value={partner.country} onChange={(e) => updatePartner("country", e.target.value)} />
                  </div>
                  <div className="vh-form-field-span2">
                    <label className="vh-form-label">Website</label>
                    <input className="vh-form-input" type="text" placeholder="https://meridian.com" value={partner.website} onChange={(e) => updatePartner("website", e.target.value)} />
                  </div>
                </div>

                <div className="vh-form-section-title">Who will run it</div>
                <div className="vh-form-grid">
                  <div>
                    <label className="vh-form-label">First name *</label>
                    <input className="vh-form-input" type="text" placeholder="Priya" value={partner.first} onChange={(e) => updatePartner("first", e.target.value)} />
                  </div>
                  <div>
                    <label className="vh-form-label">Last name *</label>
                    <input className="vh-form-input" type="text" placeholder="Nair" value={partner.last} onChange={(e) => updatePartner("last", e.target.value)} />
                  </div>
                  <div className="vh-form-field-span2">
                    <label className="vh-form-label">Admin login email *</label>
                    <input className="vh-form-input" type="email" placeholder="priya@meridian.com" value={partner.adminEmail} onChange={(e) => updatePartner("adminEmail", e.target.value)} />
                  </div>
                </div>

                <div className="vh-form-section-title">Anything else</div>
                <div className="vh-form-grid">
                  <div className="vh-form-field-span2">
                    <label className="vh-form-label">Approx. students</label>
                    <input className="vh-form-input" type="text" placeholder="150" value={partner.students} onChange={(e) => updatePartner("students", e.target.value)} />
                  </div>
                  <div className="vh-form-field-span2">
                    <label className="vh-form-label">Tell us about your centre</label>
                    <textarea
                      className="vh-form-textarea"
                      rows={4}
                      placeholder="How long you've been running, what exams you prepare students for, etc."
                      value={partner.message}
                      onChange={(e) => updatePartner("message", e.target.value)}
                    />
                  </div>
                </div>

                {partnerStatus && partnerStatus.tone === "ok" && (
                  <div className="vh-form-status vh-form-status-visible is-ok" aria-live="polite" role="status">
                    {partnerStatus.message}
                  </div>
                )}

                <button type="button" className="vh-form-submit-btn" onClick={submitDemoRequest} disabled={submittingDemo}>
                  {submittingDemo ? "Submitting..." : "Apply now"}
                  <ArrowRightIcon />
                </button>
              </>
            ) : (
              <>
                <h2>Contact Us</h2>
                <p className="vh-apply-form-lede" style={{ marginBottom: 26 }}>
                  Have questions about pricing, features, or support? Send us a message.
                </p>

                <div className="vh-form-grid">
                  <div>
                    <label className="vh-form-label">Your name *</label>
                    <input className="vh-form-input" type="text" placeholder="Priya Nair" value={query.name} onChange={(e) => updateQuery("name", e.target.value)} />
                  </div>
                  <div>
                    <label className="vh-form-label">Email address *</label>
                    <input className="vh-form-input" type="email" placeholder="priya@example.com" value={query.email} onChange={(e) => updateQuery("email", e.target.value)} />
                  </div>
                  <div className="vh-form-field-span2">
                    <label className="vh-form-label">Subject *</label>
                    <input
                      className="vh-form-input"
                      type="text"
                      placeholder="Question about student limits / Custom branding"
                      value={query.subject}
                      onChange={(e) => updateQuery("subject", e.target.value)}
                    />
                  </div>
                  <div className="vh-form-field-span2">
                    <label className="vh-form-label">Message *</label>
                    <textarea className="vh-form-textarea" rows={6} placeholder="How can we help you?" value={query.message} onChange={(e) => updateQuery("message", e.target.value)} />
                  </div>
                </div>

                {queryStatus && queryStatus.tone === "ok" && (
                  <div className="vh-form-status vh-form-status-visible is-ok" aria-live="polite" role="status">
                    {queryStatus.message}
                  </div>
                )}

                <button type="button" className="vh-form-submit-btn" onClick={submitQueryRequest} disabled={submittingQuery}>
                  {submittingQuery ? "Sending..." : "Submit query"}
                  <ArrowRightIcon />
                </button>
              </>
            )}
          </div>

          <div className="vh-contact-info-col">
            <div className="vh-info-card vh-reveal">
              <div className="vh-info-card-eyebrow">
                <span className="vh-info-card-dot" style={{ background: "#e11d2e" }} />
                Email us
              </div>
              <div className="vh-info-card-value">{contact?.email ?? "partners@visahouse.io"}</div>
              <div className="vh-info-card-note">{contact?.email_note ?? "Replies within 1 working day"}</div>
            </div>
            <div className="vh-info-card vh-reveal">
              <div className="vh-info-card-eyebrow">
                <span className="vh-info-card-dot" style={{ background: "#7c5cff" }} />
                Call sales
              </div>
              <div className="vh-info-card-value">{contact?.phone ?? "+91 80 4700 8100"}</div>
              <div className="vh-info-card-note">{contact?.phone_note ?? "Mon–Fri · 10am to 7pm IST"}</div>
            </div>
            <div className="vh-info-card vh-reveal">
              <div className="vh-info-card-eyebrow">
                <span className="vh-info-card-dot" style={{ background: "#22c55e" }} />
                Support portal
              </div>
              <div className="vh-info-card-value">{contact?.support_url ?? "support.visahouse.io"}</div>
              <div className="vh-info-card-note">{contact?.support_note ?? "Existing partners only"}</div>
            </div>
            <div className="vh-info-card vh-reveal">
              <div className="vh-office-card-title">Head office</div>
              <div className="vh-office-card-body">
                {contact?.office_name ?? "Visa House Learning Pvt. Ltd."}
                <br />
                {officeAddressLines.map((line, i) => (
                  <span key={i}>
                    {line}
                    <br />
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <PublicCtaBanner
          heading="Prefer to see it first?"
          body="Start a free 14-day trial for your institute — no card, no commitment."
          primary={{ label: user ? "Go to dashboard →" : "Sign in to portal →", onClick: goAuth }}
          secondary={{ label: "Talk to sales", href: "/contact" }}
        />

        <PublicFooter socialLinks={contactSettings?.social_links} />
      </div>
    </div>
  );
}
