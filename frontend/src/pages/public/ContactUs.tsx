import { type FormEvent, useState } from "react";
import { SearchableSelect } from "../../components/SearchableSelect";
import { useToastStore } from "../../store/toastStore";

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 6 8.5 7 8.5-7" /></svg>
  );
}

function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" /><path d="M10 21v-4h4v4" /></svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
  );
}

function UserIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  );
}

function MessageIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
  );
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5.25 3.4 9.74 8 11 4.6-1.26 8-5.75 8-11V5z" /><path d="m9 12 2 2 4-4" /></svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
  );
}

function CheckIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
}

export function ContactUs() {
  const showSuccess = useToastStore((state) => state.showSuccess);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inquiryType, setInquiryType] = useState("STUDENT");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    showSuccess("Thank you! Your message has been received.", "Inquiry Sent");
  }

  return (
    <div className="landing-page contact-page">
      {/* Background Mesh */}
      <div className="landing-ambient-orbs" aria-hidden="true">
        <div className="landing-orb orb-1" />
        <div className="landing-orb orb-2" />
      </div>

      {/* Header */}
      <section className="contact-hero-section text-center">
        <div className="contact-hero-container">
          <span className="section-kicker">GET IN TOUCH</span>
          <h1 className="hero-main-title">
            We&apos;re Here to Help You <span className="text-gradient">Succeed</span>
          </h1>
          <p className="hero-description">
            Have questions about student subscriptions, institute onboarding, or technical support? Drop us a message below.
          </p>

          <div className="contact-trust-strip">
            <span><ClockIcon /> Avg. response under 2 hours</span>
            <span className="trust-divider" aria-hidden="true" />
            <span><ShieldIcon /> Your details stay confidential</span>
            <span className="trust-divider" aria-hidden="true" />
            <span><GlobeIcon /> Supporting institutes worldwide</span>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <section className="contact-content-section">
        <div className="contact-grid">
          {/* Info Cards */}
          <div className="contact-info-col">
            <h3 className="info-title">Direct Support Channels</h3>
            <p className="info-subtitle">Pick whichever works best for you — a real person reads every message.</p>

            <a href="mailto:support@ieltslmspro.com" className="info-card">
              <div className="info-icon icon-tone-primary"><MailIcon /></div>
              <div className="info-details">
                <h4>Email Inquiries</h4>
                <p>support@ieltslmspro.com</p>
                <span className="info-tag">Response time: &lt; 2 hrs</span>
              </div>
              <span className="info-card-arrow" aria-hidden="true"><ArrowIcon /></span>
            </a>

            <a href="mailto:partnerships@ieltslmspro.com" className="info-card">
              <div className="info-icon icon-tone-violet"><BuildingIcon /></div>
              <div className="info-details">
                <h4>Institute Partnerships</h4>
                <p>partnerships@ieltslmspro.com</p>
                <span className="info-tag">Dedicated account setup</span>
              </div>
              <span className="info-card-arrow" aria-hidden="true"><ArrowIcon /></span>
            </a>

            <a href="tel:+18004358756" className="info-card">
              <div className="info-icon icon-tone-emerald"><PhoneIcon /></div>
              <div className="info-details">
                <h4>Telephone Hotline</h4>
                <p>+1 (800) 435-8756</p>
                <span className="info-tag">Mon - Fri: 8am - 8pm EST</span>
              </div>
              <span className="info-card-arrow" aria-hidden="true"><ArrowIcon /></span>
            </a>
          </div>

          {/* Form */}
          <div className="contact-form-card">
            <div className="contact-form-glow" aria-hidden="true" />
            {submitted ? (
              <div className="contact-success-state text-center">
                <div className="success-icon-badge"><CheckIcon /></div>
                <h2>Message Delivered!</h2>
                <p>Thank you for reaching out, <strong>{name}</strong>. A member of our support team will respond to <strong>{email}</strong> shortly.</p>
                <button
                  type="button"
                  className="hero-primary-btn"
                  onClick={() => {
                    setSubmitted(false);
                    setName("");
                    setEmail("");
                    setMessage("");
                  }}
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form">
                <h3>Send an Inquiry</h3>
                <p className="contact-form-subtitle">Fill in the form below and our team will get back to you shortly.</p>

                <div className="form-group">
                  <label htmlFor="contact_name">Your Full Name</label>
                  <div className="input-with-icon">
                    <UserIcon />
                    <input
                      id="contact_name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="contact_email">Email Address</label>
                  <div className="input-with-icon">
                    <MailIcon />
                    <input
                      id="contact_email"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="contact_type">I am inquiring as a:</label>
                  <SearchableSelect
                    id="contact_type"
                    options={[
                      { value: "STUDENT", label: "Direct IELTS Student" },
                      { value: "INSTITUTE", label: "Institute Owner / Director" },
                      { value: "INSTRUCTOR", label: "IELTS Trainer / Teacher" },
                      { value: "OTHER", label: "Other Partner / Business" },
                    ]}
                    value={inquiryType}
                    onChange={(value) => setInquiryType(String(value))}
                    searchable={false}
                    className="form-dropdown-select contact-select"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contact_msg">Your Message</label>
                  <div className="input-with-icon input-with-icon-textarea">
                    <MessageIcon />
                    <textarea
                      id="contact_msg"
                      rows={4}
                      placeholder="Tell us how we can assist you..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      required
                      className="contact-textarea"
                    />
                  </div>
                </div>

                <button type="submit" className="hero-primary-btn w-full contact-submit-btn">
                  Send Inquiry Message <ArrowIcon />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
