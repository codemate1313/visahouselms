import { type FormEvent, useState } from "react";
import { useToastStore } from "../../store/toastStore";

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
          <span className="section-kicker">CONTACT &amp; SUPPORT</span>
          <h1 className="hero-main-title">
            We&apos;re Here to Help You <span className="text-gradient">Succeed</span>
          </h1>
          <p className="hero-description">
            Have questions about student subscriptions, institute onboarding, or technical support? Drop us a message below.
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <section className="contact-content-section">
        <div className="contact-grid">
          {/* Info Cards */}
          <div className="contact-info-col">
            <h3 className="info-title">Direct Support Channels</h3>

            <div className="info-card">
              <div className="info-icon">📧</div>
              <div className="info-details">
                <h4>Email Inquiries</h4>
                <p>support@ieltslmspro.com</p>
                <span className="info-tag">Response time: &lt; 2 hrs</span>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">🏢</div>
              <div className="info-details">
                <h4>Institute Partnerships</h4>
                <p>partnerships@ieltslmspro.com</p>
                <span className="info-tag">Dedicated account setup</span>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">📞</div>
              <div className="info-details">
                <h4>Telephone Hotline</h4>
                <p>+1 (800) 435-8756</p>
                <span className="info-tag">Mon - Fri: 8am - 8pm EST</span>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="contact-form-card">
            {submitted ? (
              <div className="contact-success-state text-center">
                <div className="success-icon-badge">✅</div>
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

                <div className="form-group">
                  <label htmlFor="contact_name">Your Full Name</label>
                  <input
                    id="contact_name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contact_email">Email Address</label>
                  <input
                    id="contact_email"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="contact_type">I am inquiring as a:</label>
                  <select
                    id="contact_type"
                    value={inquiryType}
                    onChange={(e) => setInquiryType(e.target.value)}
                    className="contact-select"
                  >
                    <option value="STUDENT">Direct IELTS Student</option>
                    <option value="INSTITUTE">Institute Owner / Director</option>
                    <option value="INSTRUCTOR">IELTS Trainer / Teacher</option>
                    <option value="OTHER">Other Partner / Business</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="contact_msg">Your Message</label>
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

                <button type="submit" className="hero-primary-btn w-full">
                  Send Inquiry Message →
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
