import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { apiClient, API_BASE_URL } from "@/api/client";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { ReCaptchaWidget } from "@/components/publicSite/ReCaptchaWidget";
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
    return { isOpen: true, text: "Open now (9am – 5pm IST)" };
  }
  return { isOpen: false, text: "Closed now · Mon–Fri 9am–5pm IST" };
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

const OFFICE_BRANCHES: OfficeBranch[] = [
  {
    id: "amritsar",
    city: "Amritsar",
    name: "Amritsar Office",
    tag: "Head Office",
    address: "Mezzanine floor, Sco-21, B-Block, Ranjit Avenue, Amritsar, Punjab 143001",
    addressShort: "Sco-21, B-Block, Ranjit Avenue, Amritsar",
    mapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3692.6816320116436!2d74.8629167!3d31.65075!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3919650028ff0af9%3A0x7c60b7408534d94d!2sVISA%20HOUSE%20immigration!5e0!3m2!1sen!2sin!4v1786779632431!5m2!1sen!2sin",
    mapLink: "https://www.google.com/maps/place/VISA+HOUSE+immigration/@31.65075,74.8629167,17z",
    phone: "+91 9779047164",
  },
  {
    id: "tarntaran",
    city: "Tarn Taran",
    name: "Tarn Taran Office",
    tag: "Branch Office",
    address: "Gali Lakeer Sahib Wali, Amritsar Bypass Road, Tarn Taran, Punjab 143401",
    addressShort: "Gali Lakeer Sahib Wali, Bypass Rd, Tarn Taran",
    mapEmbedUrl:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3403.475908208477!2d74.9170435!3d31.4638482!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39197f991e05cd0f%3A0x64c8d99f3ec4c656!2sVisa%20House!5e0!3m2!1sen!2sin!4v1786779800000!5m2!1sen!2sin",
    mapLink: "https://maps.app.goo.gl/9DfwXmJcfyzQnwC67",
    phone: "+91 9779047164",
  },
];

export function ContactUs() {
  useSEO({ title: "Contact Us", description: "Email, call or contact Visa House for LanguageCert LMS support and institute demos." });
  const location = useLocation();
  const contactSettings = useContactSettings();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const formSectionRef = useRef<HTMLElement | null>(null);

  useRevealOnScroll(rootRef);

  const [institutePlans, setInstitutePlans] = useState<LandingPlan[]>([]);
  const [formType, setFormType] = useState<FormType>(() => getInitialFormType(location.search));
  const [selectedBranchId, setSelectedBranchId] = useState<string>("amritsar");

  const officeStatus = getOfficeStatus();
  const activeBranch = OFFICE_BRANCHES.find((b) => b.id === selectedBranchId) ?? OFFICE_BRANCHES[0];

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

  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaError, setCaptchaError] = useState(false);

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
    setCaptchaError(false);
  }

  function updatePartner<K extends keyof typeof EMPTY_PARTNER_FORM>(key: K, value: string) {
    setPartner((prev) => ({ ...prev, [key]: value }));
  }
  function updateQuery<K extends keyof typeof EMPTY_QUERY_FORM>(key: K, value: string) {
    setQuery((prev) => ({ ...prev, [key]: value }));
  }

  async function submitDemoRequest() {
    if (submittingDemo) return;
    const { instName, email, phone, city, country, website, first, last, adminEmail, students, instructors, message } = partner;
    if (!instName.trim() || !email.trim() || !phone.trim() || !first.trim() || !last.trim() || !adminEmail.trim()) {
      const msg = "Please fill in all required fields marked with *.";
      setPartnerStatus({ message: msg, tone: "error" });
      useToastStore.getState().showError(msg);
      return;
    }

    if (!captchaVerified) {
      const msg = "Please verify that you are not a robot.";
      setCaptchaError(true);
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
      setCaptchaVerified(false);
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
    const { name, email, subject, message } = query;
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      const msg = "Please fill in all fields.";
      setQueryStatus({ message: msg, tone: "error" });
      useToastStore.getState().showError(msg);
      return;
    }

    if (!captchaVerified) {
      const msg = "Please verify that you are not a robot.";
      setCaptchaError(true);
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
      setCaptchaVerified(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "We could not submit your enquiry. Please email enquiry.langugaecert@gmail.com.";
      setQueryStatus({ message: errorMsg, tone: "error" });
      useToastStore.getState().showError(errorMsg);
    } finally {
      setSubmittingQuery(false);
    }
  }

  const contact = contactSettings?.contact;

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
                <a className="vh-contact-detail" href={`tel:${contact?.phone ?? "+919779047164"}`}>
                  <ContactInfoIcon type="phone" />
                  <span className="vh-contact-detail-copy">
                    <strong>Phone</strong>
                    <span>{contact?.phone ?? "+91 9779047164"}</span>
                    <small>{officeStatus.text}</small>
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

                {OFFICE_BRANCHES.map((b) => (
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
                      <strong>{b.name} ({b.tag})</strong>
                      <span>{b.address}</span>
                      <small>Open in Google Maps ↗</small>
                    </span>
                  </a>
                ))}

                <a className="vh-contact-detail vh-contact-detail-span2" href="https://support.visahouse.com" target="_blank" rel="noopener noreferrer">
                  <ContactInfoIcon type="support" />
                  <span className="vh-contact-detail-copy">
                    <strong>Support portal</strong>
                    <span>{contact?.support_url ?? "support.visahouse.com (to be created)"}</span>
                    <small>{contact?.support_note ?? "Existing partners only"}</small>
                  </span>
                </a>
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
                <>
                  {interestedPlanName ? <div className="vh-plan-badge">Interested in: {interestedPlanName} Plan</div> : null}
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

                  <ReCaptchaWidget
                    verified={captchaVerified}
                    onVerify={(v) => {
                      setCaptchaVerified(v);
                      setCaptchaError(false);
                    }}
                    hasError={captchaError}
                  />

                  {partnerStatus ? (
                    <div className={`vh-form-status vh-form-status-visible is-${partnerStatus.tone}`} aria-live="polite" role="status">
                      {partnerStatus.message}
                    </div>
                  ) : null}

                  <button type="button" className="vh-form-submit-btn" onClick={submitDemoRequest} disabled={submittingDemo}>
                    {submittingDemo ? "Submitting..." : "Apply now"}
                  </button>
                </>
              ) : (
                <>
                  <div className="vh-form-grid">
                    <div>
                      <label className="vh-form-label">Your full name *</label>
                      <input className="vh-form-input" type="text" placeholder="Priya Nair" value={query.name} onChange={(e) => updateQuery("name", e.target.value)} />
                    </div>
                    <div>
                      <label className="vh-form-label">Email address *</label>
                      <input className="vh-form-input" type="email" placeholder="priya@example.com" value={query.email} onChange={(e) => updateQuery("email", e.target.value)} />
                    </div>
                    <div className="vh-form-field-span2">
                      <label className="vh-form-label">Subject *</label>
                      <input className="vh-form-input" type="text" placeholder="How can we help?" value={query.subject} onChange={(e) => updateQuery("subject", e.target.value)} />
                    </div>
                    <div className="vh-form-field-span2">
                      <label className="vh-form-label">Message *</label>
                      <textarea className="vh-form-textarea" rows={5} placeholder="Tell us what you need help with." value={query.message} onChange={(e) => updateQuery("message", e.target.value)} />
                    </div>
                  </div>

                  <ReCaptchaWidget
                    verified={captchaVerified}
                    onVerify={(v) => {
                      setCaptchaVerified(v);
                      setCaptchaError(false);
                    }}
                    hasError={captchaError}
                  />

                  {queryStatus ? (
                    <div className={`vh-form-status vh-form-status-visible is-${queryStatus.tone}`} aria-live="polite" role="status">
                      {queryStatus.message}
                    </div>
                  ) : null}

                  <button type="button" className="vh-form-submit-btn" onClick={submitQueryRequest} disabled={submittingQuery}>
                    {submittingQuery ? "Sending..." : "Submit request"}
                  </button>
                </>
              )}
            </section>

            <section className="vh-contact-map-section" aria-labelledby="visit-office-title">
              <div className="vh-contact-map-heading">
                <div>
                  <div className="vh-contact-map-title-row">
                    <h2 id="visit-office-title">Visit our offices</h2>
                    <div className="vh-branch-toggle-pills" role="tablist" aria-label="Select office branch">
                      {OFFICE_BRANCHES.map((b) => (
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
