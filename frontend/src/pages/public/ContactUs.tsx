import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { apiClient, API_BASE_URL } from "@/api/client";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { useSEO } from "@/hooks/useSEO";
import { useContactSettings } from "./useContactSettings";
import type { LandingPlan, LandingPlansPayload } from "./Plans.types";
import { useRevealOnScroll } from "@/components/publicSite/useRevealOnScroll";
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
  instructors: "",
  message: "",
};

const EMPTY_QUERY_FORM = { name: "", email: "", subject: "", message: "" };

// Basic email-format backup check. Native `type="email"` + `required` on the
// inputs handle validation for real form submissions; this covers any path
// where the submit handler runs without a genuine browser submit event.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function getOfficeStatus(): { isOpen: boolean; text: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 5.5 * 3600000);

  const day = istDate.getDay();
  const hour = istDate.getHours();

  const isWeekday = day >= 1 && day <= 5;
  const isBusinessHours = hour >= 9 && hour < 17;

  if (isWeekday && isBusinessHours) {
    return { isOpen: true, text: "Open now (9am – 5pm IST — your local time may differ)" };
  }
  return { isOpen: false, text: "Closed now · Mon–Fri 9am–5pm IST — your local time may differ" };
}

function ContactInfoIcon({ type }: { type: "phone" | "location" | "email" | "support" }) {
  const paths = {
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.08 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92z" />,
    location: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    email: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    support: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12h7M12 8.5v7" />
      </>
    ),
  };

  return (
    <span className={`vh-contact-info-icon is-${type}`} aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {paths[type]}
      </svg>
    </span>
  );
}

interface OfficeBranch {
  id: string;
  city: string;
  name: string;
  tag: string;
  address: string;
  addressShort: string;
  mapEmbedUrl: string;
  mapLink: string;
  phone: string;
}

export function ContactUs() {
  useSEO({ title: "Contact Us", description: "Email, call or contact Visa House for LanguageCert LMS support and institute demos." });
  const location = useLocation();
  const contactSettings = useContactSettings();
  const contact = contactSettings?.contact;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = useRef<HTMLElement | null>(null);

  useRevealOnScroll(rootRef);

  const [institutePlans, setInstitutePlans] = useState<LandingPlan[]>([]);
  const [formType, setFormType] = useState<FormType>(() => getInitialFormType(location.search));
  const [selectedBranchId, setSelectedBranchId] = useState<string>("amritsar");

  const officeStatus = getOfficeStatus();

  const officeBranches: OfficeBranch[] = [
    {
      id: "amritsar",
      city: "Amritsar",
      name: contact?.head_office_name || "Amritsar Office (Head Office)",
      tag: "Head Office",
      address: contact?.head_office_address || "Mezzanine floor, Sco-21, B-Block, Ranjit Avenue, Amritsar, Punjab 143001",
      addressShort: "Sco-21, B-Block, Ranjit Avenue, Amritsar",
      mapEmbedUrl:
        contact?.head_office_map_embed ||
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3692.6816320116436!2d74.8629167!3d31.65075!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3919650028ff0af9%3A0x7c60b7408534d94d!2sVISA%20HOUSE%20immigration!5e0!3m2!1sen!2sin!4v1786779632431!5m2!1sen!2sin",
      mapLink: contact?.head_office_map_link || "https://www.google.com/maps/place/VISA+HOUSE+immigration/@31.65075,74.8629167,17z",
      phone: contact?.phone || "+91 9779047164",
    },
    {
      id: "tarntaran",
      city: "Tarn Taran",
      name: contact?.branch_office_name || "Tarn Taran Office (Branch Office)",
      tag: "Branch Office",
      address: contact?.branch_office_address || "Gali Lakeer Sahib Wali, Amritsar Bypass Road, Tarn Taran, Punjab 143401",
      addressShort: "Gali Lakeer Sahib Wali, Bypass Rd, Tarn Taran",
      mapEmbedUrl:
        contact?.branch_office_map_embed ||
        "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3403.475908208477!2d74.9170435!3d31.4638482!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39197f991e05cd0f%3A0x64c8d99f3ec4c656!2sVisa%20House!5e0!3m2!1sen!2sin!4v1786779800000!5m2!1sen!2sin",
      mapLink: contact?.branch_office_map_link || "https://maps.app.goo.gl/9DfwXmJcfyzQnwC67",
      phone: contact?.phone || "+91 9779047164",
    },
  ];

  const activeBranch = officeBranches.find((b) => b.id === selectedBranchId) ?? officeBranches[0];

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
  const [partnerErrors, setPartnerErrors] = useState<Partial<Record<keyof typeof EMPTY_PARTNER_FORM, string>>>({});
  const [submittingDemo, setSubmittingDemo] = useState(false);

  const [query, setQuery] = useState(EMPTY_QUERY_FORM);
  const [queryStatus, setQueryStatus] = useState<FormStatus | null>(null);
  const [queryErrors, setQueryErrors] = useState<Partial<Record<keyof typeof EMPTY_QUERY_FORM, string>>>({});
  const [submittingQuery, setSubmittingQuery] = useState(false);

  // Honeypot fields: invisible to real users, but a bot filling in every
  // input on the page will populate them. Not a substitute for real
  // server-verified bot protection, only a lightweight frontend deterrent.
  const [partnerHoneypot, setPartnerHoneypot] = useState("");
  const [queryHoneypot, setQueryHoneypot] = useState("");

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
    setPartnerErrors({});
    setQueryErrors({});
  }

  function updatePartner<K extends keyof typeof EMPTY_PARTNER_FORM>(key: K, value: string) {
    setPartner((prev) => ({ ...prev, [key]: value }));
    setPartnerErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }
  function updateQuery<K extends keyof typeof EMPTY_QUERY_FORM>(key: K, value: string) {
    setQuery((prev) => ({ ...prev, [key]: value }));
    setQueryErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function submitDemoRequest() {
    if (submittingDemo) return;
    if (partnerHoneypot.trim()) {
      // Honeypot field was filled in — this is almost certainly a bot.
      // Reject silently without giving the bot any diagnostic feedback.
      return;
    }
    const { instName, email, phone, city, country, website, first, last, adminEmail, students, instructors, message } = partner;

    const fieldErrors: Partial<Record<keyof typeof EMPTY_PARTNER_FORM, string>> = {};
    if (!instName.trim()) fieldErrors.instName = "Institute name is required.";
    if (!email.trim()) fieldErrors.email = "Institute contact email is required.";
    else if (!EMAIL_REGEX.test(email.trim())) fieldErrors.email = "Enter a valid email address.";
    if (!phone.trim()) fieldErrors.phone = "Phone number is required.";
    if (!first.trim()) fieldErrors.first = "First name is required.";
    if (!last.trim()) fieldErrors.last = "Last name is required.";
    if (!adminEmail.trim()) fieldErrors.adminEmail = "Admin login email is required.";
    else if (!EMAIL_REGEX.test(adminEmail.trim())) fieldErrors.adminEmail = "Enter a valid email address.";

    if (Object.keys(fieldErrors).length > 0) {
      setPartnerErrors(fieldErrors);
      const msg = "Please fix the highlighted fields below.";
      setPartnerStatus({ message: msg, tone: "error" });
      useToastStore.getState().showError(msg);
      return;
    }
    setPartnerErrors({});

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
          expected_instructors: instructors.trim() ? Number(instructors.trim()) : null,
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
      setPartnerHoneypot("");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "We could not submit your application. Please email enquiry.langugaecert@gmail.com.";
      setPartnerStatus({ message: errorMsg, tone: "error" });
      useToastStore.getState().showError(errorMsg);
    } finally {
      setSubmittingDemo(false);
    }
  }

  async function submitQueryRequest() {
    if (submittingQuery) return;
    if (queryHoneypot.trim()) {
      // Honeypot field was filled in — this is almost certainly a bot.
      // Reject silently without giving the bot any diagnostic feedback.
      return;
    }
    const { name, email, subject, message } = query;

    const fieldErrors: Partial<Record<keyof typeof EMPTY_QUERY_FORM, string>> = {};
    if (!name.trim()) fieldErrors.name = "Your name is required.";
    if (!email.trim()) fieldErrors.email = "Email address is required.";
    else if (!EMAIL_REGEX.test(email.trim())) fieldErrors.email = "Enter a valid email address.";
    if (!subject.trim()) fieldErrors.subject = "Subject is required.";
    if (!message.trim()) fieldErrors.message = "Message is required.";

    if (Object.keys(fieldErrors).length > 0) {
      setQueryErrors(fieldErrors);
      const msg = "Please fix the highlighted fields below.";
      setQueryStatus({ message: msg, tone: "error" });
      useToastStore.getState().showError(msg);
      return;
    }
    setQueryErrors({});

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
      setQueryHoneypot("");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "We could not submit your enquiry. Please email enquiry.langugaecert@gmail.com.";
      setQueryStatus({ message: errorMsg, tone: "error" });
      useToastStore.getState().showError(errorMsg);
    } finally {
      setSubmittingQuery(false);
    }
  }

  return (
    <div className="vh-public vh-contact-page" ref={rootRef}>
      <div className="vh-page-content">
        <PublicHeader />

        <section className="vh-contact-hero">
          <div className="vh-contact-hero-copy">
            <h1>
              Get in touch <span className="vh-accent">with our team</span>
            </h1>
            <p>Connect with our experts to discuss your needs and discover how Visa House can support your goals.</p>
          </div>
        </section>

        <main className="vh-contact-stage" ref={formSectionRef}>
          <div className="vh-contact-panel vh-reveal">
            <section className="vh-contact-company" aria-labelledby="company-information-title">
              <h2 id="company-information-title">Company information</h2>
              <div className="vh-contact-details-grid">
                <a className="vh-contact-detail" href={`tel:${(contact?.phone ?? "+919779047164").replace(/\s+/g, "")}`}>
                  <ContactInfoIcon type="phone" />
                  <span className="vh-contact-detail-copy">
                    <strong>Phone</strong>
                    <span>{contact?.phone ?? "+91 9779047164"}</span>
                    <small>{contact?.phone_note || officeStatus.text}</small>
                  </span>
                </a>

                <a className="vh-contact-detail" href={`mailto:${contact?.email ?? "enquiry.langugaecert@gmail.com"}`}>
                  <ContactInfoIcon type="email" />
                  <span className="vh-contact-detail-copy">
                    <strong>Email</strong>
                    <span>{contact?.email ?? "enquiry.langugaecert@gmail.com"}</span>
                    <small>{contact?.email_note ?? "Replies within 1 working day"}</small>
                  </span>
                </a>

                {officeBranches.map((b) => (
                  <a
                    key={b.id}
                    className="vh-contact-detail"
                    href={b.mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setSelectedBranchId(b.id);
                    }}
                  >
                    <ContactInfoIcon type="location" />
                    <span className="vh-contact-detail-copy">
                      <strong>{b.name}</strong>
                      <span>{b.address}</span>
                      <small>Open in Google Maps ↗</small>
                    </span>
                  </a>
                ))}

                {contact?.support_url ? (
                  <a className="vh-contact-detail vh-contact-detail-span2" href={contact.support_url} target="_blank" rel="noopener noreferrer">
                    <ContactInfoIcon type="support" />
                    <span className="vh-contact-detail-copy">
                      <strong>Support portal</strong>
                      <span>{contact.support_url}</span>
                      <small>{contact?.support_note ?? "Existing partners only"}</small>
                    </span>
                  </a>
                ) : (
                  // Not clickable: no backend-configured support_url yet, so
                  // there is no real destination to send visitors to.
                  <div className="vh-contact-detail vh-contact-detail-span2" aria-disabled="true">
                    <ContactInfoIcon type="support" />
                    <span className="vh-contact-detail-copy">
                      <strong>Support portal</strong>
                      <span>Coming soon</span>
                      <small>Existing partners only</small>
                    </span>
                  </div>
                )}
              </div>
            </section>

            <section className="vh-contact-form-card" aria-labelledby="partner-form-heading">
              <div className="vh-contact-form-header">
                <div className="vh-contact-form-title-wrap">
                  <h2 id="partner-form-heading">{formType === "partner" ? "Partner information" : "Send us a message"}</h2>
                  <p>{formType === "partner" ? "Tell us about your centre and the person who will manage it." : "We're here to help answer questions and get you started."}</p>
                </div>
                
                <div className="vh-form-horizontal-tabs" role="tablist" aria-label="Contact form options">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={formType === "query"}
                    className={`vh-form-tab-btn ${formType === "query" ? "is-active" : ""}`}
                    onClick={() => switchForm("query")}
                  >
                    Contact Us
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={formType === "partner"}
                    className={`vh-form-tab-btn ${formType === "partner" ? "is-active" : ""}`}
                    onClick={() => switchForm("partner")}
                  >
                    Become a Partner
                  </button>
                </div>
              </div>

              {formType === "partner" ? (
                <form
                  onSubmit={(e: FormEvent<HTMLFormElement>) => {
                    e.preventDefault();
                    void submitDemoRequest();
                  }}
                >
                  {interestedPlanName ? <div className="vh-plan-badge">Interested in: {interestedPlanName} Plan</div> : null}
                  <div className="vh-form-section-title">About your institute</div>
                  <div className="vh-form-grid">
                    <div className="vh-form-field-span2">
                      <label className="vh-form-label">Institute name *</label>
                      <input
                        className={`vh-form-input ${partnerErrors.instName ? "vh-form-input-error" : ""}`}
                        type="text"
                        required
                        placeholder="Meridian Institute"
                        value={partner.instName}
                        onChange={(e) => updatePartner("instName", e.target.value)}
                        aria-invalid={partnerErrors.instName ? true : undefined}
                      />
                      {partnerErrors.instName && <span className="vh-form-field-error">{partnerErrors.instName}</span>}
                    </div>
                    <div>
                      <label className="vh-form-label">Institute contact email *</label>
                      <input
                        className={`vh-form-input ${partnerErrors.email ? "vh-form-input-error" : ""}`}
                        type="email"
                        required
                        placeholder="info@meridian.com"
                        value={partner.email}
                        onChange={(e) => updatePartner("email", e.target.value)}
                        aria-invalid={partnerErrors.email ? true : undefined}
                      />
                      {partnerErrors.email && <span className="vh-form-field-error">{partnerErrors.email}</span>}
                    </div>
                    <div>
                      <label className="vh-form-label">Phone *</label>
                      <input
                        className={`vh-form-input ${partnerErrors.phone ? "vh-form-input-error" : ""}`}
                        type="tel"
                        required
                        placeholder="+91 99999 99999"
                        value={partner.phone}
                        onChange={(e) => updatePartner("phone", e.target.value)}
                        aria-invalid={partnerErrors.phone ? true : undefined}
                      />
                      {partnerErrors.phone && <span className="vh-form-field-error">{partnerErrors.phone}</span>}
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
                      <input
                        className={`vh-form-input ${partnerErrors.first ? "vh-form-input-error" : ""}`}
                        type="text"
                        required
                        placeholder="Priya"
                        value={partner.first}
                        onChange={(e) => updatePartner("first", e.target.value)}
                        aria-invalid={partnerErrors.first ? true : undefined}
                      />
                      {partnerErrors.first && <span className="vh-form-field-error">{partnerErrors.first}</span>}
                    </div>
                    <div>
                      <label className="vh-form-label">Last name *</label>
                      <input
                        className={`vh-form-input ${partnerErrors.last ? "vh-form-input-error" : ""}`}
                        type="text"
                        required
                        placeholder="Nair"
                        value={partner.last}
                        onChange={(e) => updatePartner("last", e.target.value)}
                        aria-invalid={partnerErrors.last ? true : undefined}
                      />
                      {partnerErrors.last && <span className="vh-form-field-error">{partnerErrors.last}</span>}
                    </div>
                    <div className="vh-form-field-span2">
                      <label className="vh-form-label">Admin login email *</label>
                      <input
                        className={`vh-form-input ${partnerErrors.adminEmail ? "vh-form-input-error" : ""}`}
                        type="email"
                        required
                        placeholder="priya@meridian.com"
                        value={partner.adminEmail}
                        onChange={(e) => updatePartner("adminEmail", e.target.value)}
                        aria-invalid={partnerErrors.adminEmail ? true : undefined}
                      />
                      {partnerErrors.adminEmail && <span className="vh-form-field-error">{partnerErrors.adminEmail}</span>}
                    </div>
                  </div>

                  <div className="vh-form-section-title">Anything else</div>
                  <div className="vh-form-grid">
                    <div>
                      <label className="vh-form-label">Approx. students</label>
                      <input className="vh-form-input" type="number" min="0" placeholder="150" value={partner.students} onChange={(e) => updatePartner("students", e.target.value)} />
                    </div>
                    <div>
                      <label className="vh-form-label">Approx. instructors</label>
                      <input className="vh-form-input" type="number" min="0" placeholder="5" value={partner.instructors} onChange={(e) => updatePartner("instructors", e.target.value)} />
                    </div>
                    <div className="vh-form-field-span2">
                      <label className="vh-form-label">Tell us about your centre</label>
                      <textarea className="vh-form-textarea" rows={4} placeholder="How long you've been running and which exams you prepare students for." value={partner.message} onChange={(e) => updatePartner("message", e.target.value)} />
                    </div>
                  </div>

                  {/* Honeypot: hidden from real users, catches naive bots that fill every field. */}
                  <div style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }} aria-hidden="true">
                    <label htmlFor="partner-hp-field">Leave this field blank</label>
                    <input
                      id="partner-hp-field"
                      type="text"
                      name="company_website_url"
                      tabIndex={-1}
                      autoComplete="off"
                      value={partnerHoneypot}
                      onChange={(e) => setPartnerHoneypot(e.target.value)}
                    />
                  </div>

                  {partnerStatus ? (
                    <div className={`vh-form-status vh-form-status-visible is-${partnerStatus.tone}`} aria-live="polite" role="status">
                      {partnerStatus.message}
                    </div>
                  ) : null}

                  <button type="submit" className="vh-form-submit-btn" disabled={submittingDemo}>
                    {submittingDemo ? "Submitting..." : "Apply now"}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={(e: FormEvent<HTMLFormElement>) => {
                    e.preventDefault();
                    void submitQueryRequest();
                  }}
                >
                  <div className="vh-form-grid">
                    <div>
                      <label className="vh-form-label">Your full name *</label>
                      <input
                        className={`vh-form-input ${queryErrors.name ? "vh-form-input-error" : ""}`}
                        type="text"
                        required
                        placeholder="Priya Nair"
                        value={query.name}
                        onChange={(e) => updateQuery("name", e.target.value)}
                        aria-invalid={queryErrors.name ? true : undefined}
                      />
                      {queryErrors.name && <span className="vh-form-field-error">{queryErrors.name}</span>}
                    </div>
                    <div>
                      <label className="vh-form-label">Email address *</label>
                      <input
                        className={`vh-form-input ${queryErrors.email ? "vh-form-input-error" : ""}`}
                        type="email"
                        required
                        placeholder="priya@example.com"
                        value={query.email}
                        onChange={(e) => updateQuery("email", e.target.value)}
                        aria-invalid={queryErrors.email ? true : undefined}
                      />
                      {queryErrors.email && <span className="vh-form-field-error">{queryErrors.email}</span>}
                    </div>
                    <div className="vh-form-field-span2">
                      <label className="vh-form-label">Subject *</label>
                      <input
                        className={`vh-form-input ${queryErrors.subject ? "vh-form-input-error" : ""}`}
                        type="text"
                        required
                        placeholder="How can we help?"
                        value={query.subject}
                        onChange={(e) => updateQuery("subject", e.target.value)}
                        aria-invalid={queryErrors.subject ? true : undefined}
                      />
                      {queryErrors.subject && <span className="vh-form-field-error">{queryErrors.subject}</span>}
                    </div>
                    <div className="vh-form-field-span2">
                      <label className="vh-form-label">Message *</label>
                      <textarea
                        className={`vh-form-textarea ${queryErrors.message ? "vh-form-input-error" : ""}`}
                        rows={5}
                        required
                        placeholder="Tell us what you need help with."
                        value={query.message}
                        onChange={(e) => updateQuery("message", e.target.value)}
                        aria-invalid={queryErrors.message ? true : undefined}
                      />
                      {queryErrors.message && <span className="vh-form-field-error">{queryErrors.message}</span>}
                    </div>
                  </div>

                  {/* Honeypot: hidden from real users, catches naive bots that fill every field. */}
                  <div style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }} aria-hidden="true">
                    <label htmlFor="query-hp-field">Leave this field blank</label>
                    <input
                      id="query-hp-field"
                      type="text"
                      name="company_website_url"
                      tabIndex={-1}
                      autoComplete="off"
                      value={queryHoneypot}
                      onChange={(e) => setQueryHoneypot(e.target.value)}
                    />
                  </div>

                  {queryStatus ? (
                    <div className={`vh-form-status vh-form-status-visible is-${queryStatus.tone}`} aria-live="polite" role="status">
                      {queryStatus.message}
                    </div>
                  ) : null}

                  <button type="submit" className="vh-form-submit-btn" disabled={submittingQuery}>
                    {submittingQuery ? "Sending..." : "Submit request"}
                  </button>
                </form>
              )}
            </section>

            <section className="vh-contact-map-section" aria-labelledby="visit-office-title">
              <div className="vh-contact-map-heading">
                <div>
                  <div className="vh-contact-map-title-row">
                    <h2 id="visit-office-title">Visit our offices</h2>
                    <div className="vh-branch-toggle-pills" role="tablist" aria-label="Select office branch">
                      {officeBranches.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          role="tab"
                          aria-selected={b.id === selectedBranchId}
                          className={`vh-branch-pill ${b.id === selectedBranchId ? "is-active" : ""}`}
                          onClick={() => setSelectedBranchId(b.id)}
                        >
                          <span className="vh-branch-pill-dot" />
                          <span className="vh-branch-pill-city">{b.city}</span>
                          <span className="vh-branch-pill-badge">{b.tag}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="vh-contact-map-sub">{activeBranch.name} · {activeBranch.address}</p>
                </div>
                <a href={activeBranch.mapLink} target="_blank" rel="noopener noreferrer" className="vh-map-overlay-btn">
                  Open in Google Maps ↗
                </a>
              </div>

              <div className="vh-map-container">
                <iframe
                  key={activeBranch.id}
                  title={`${activeBranch.name} Location Map`}
                  src={activeBranch.mapEmbedUrl}
                  width="100%"
                  height="390"
                  style={{ border: 0, display: "block" }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </section>
          </div>
        </main>

        <PublicFooter socialLinks={contactSettings?.social_links} />
      </div>
    </div>
  );
}
