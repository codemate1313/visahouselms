import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "@/api/client";
import { PublicHeader } from "@/components/publicSite/PublicHeader";
import { PublicFooter } from "@/components/publicSite/PublicFooter";
import { PublicOrbBackground } from "@/components/publicSite/PublicOrbBackground";
import { PublicCtaBanner } from "@/components/publicSite/PublicCtaBanner";
import { InstitutePlanBanner } from "@/components/publicSite/InstitutePlanBanner";
import { usePublicAuthAction } from "@/components/publicSite/usePublicAuthAction";
import { useRevealOnScroll } from "@/components/publicSite/useRevealOnScroll";
import { VouchersSection } from "@/components/landing/VouchersSection";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { destinationFor } from "@/pages/Login/helpers";
import { useSEO } from "@/hooks/useSEO";
import { useContactSettings } from "./useContactSettings";
import type { LandingPlan, LandingPlansPayload } from "./Plans.types";
import { SegmentedControl } from "@/components/ui";
import "@/styles/public/chrome.css";
import "@/styles/public/plans.css";

type Audience = "students" | "institutes";
type Billing = "monthly" | "annual";

const FAQS = [
  { q: "How do I get started?", a: "Simply choose your preparation plan, create your account and start practising. Your dashboard will guide you through the available resources and help you track your preparation." },
  { q: "Is LanguageCert LMS suitable for beginners?", a: "Yes. Whether you're starting your preparation from scratch or looking to improve your existing performance, you can use the platform to practise at your level and work towards your target result." },
  { q: "Can I practise Writing and Speaking?", a: "Yes. LanguageCert LMS provides dedicated Writing and Speaking practice, along with feedback and performance insights to help you identify areas for improvement." },
  { q: "How can I track my progress?", a: "Your performance is recorded within your LMS dashboard, allowing you to review your results, monitor improvement and identify the skills that need more attention." },
  { q: "Can I get help if I have a problem with my preparation?", a: "Yes. You can contact the LanguageCert LMS support team for assistance with the platform, preparation resources and account-related questions." },
];

function formatPrice(plan: LandingPlan) {
  const amount = Number(plan.price);
  if (!Number.isFinite(amount)) return String(plan.price ?? "");
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: plan.currency || "INR",
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${plan.currency || "INR"} ${amount.toLocaleString("en-IN")}`;
  }
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PlanCard({ plan, featured, onSelect, onChoose }: { plan: LandingPlan; featured: boolean; onSelect: () => void; onChoose: () => void }) {
  const forInstitutes = plan.audience === "institutes";
  const cardBg = featured ? "linear-gradient(155deg, var(--ac), var(--ac2))" : "var(--card)";
  const cardInk = featured ? "#fff" : "var(--ink)";
  const cardBorder = featured ? "transparent" : "var(--line)";
  const cardShadow = featured ? "0 30px 60px -24px var(--ac)" : "none";
  const mutedInk = featured ? "rgba(255,255,255,0.86)" : "var(--ink2)";
  const featureInk = featured ? "rgba(255,255,255,0.95)" : "var(--ink)";
  const ctaBg = featured ? "#fff" : "transparent";
  const ctaInk = featured ? "var(--ac)" : "var(--ink)";
  const ctaBorder = featured ? "transparent" : "var(--line)";
  const checkBg = featured ? "rgba(255,255,255,0.22)" : "var(--acWash)";
  const checkInk = featured ? "#fff" : "var(--ac)";

  return (
    <div className="vh-plan-card vh-reveal" style={{ background: cardBg, color: cardInk, borderColor: cardBorder, boxShadow: cardShadow }} onClick={onSelect}>
      {featured && <div className="vh-plan-badge">Most popular</div>}
      <div className="vh-plan-name" style={{ color: mutedInk }}>
        {plan.name}
      </div>
      <div className="vh-plan-price-row">
        <span className="vh-plan-price">{formatPrice(plan)}</span>
        <span className="vh-plan-period" style={{ color: mutedInk }}>
          {plan.period_label}
        </span>
      </div>
      {plan.description && (
        <p className="vh-plan-desc" style={{ color: mutedInk }}>
          {plan.description}
        </p>
      )}
      <button
        type="button"
        className="vh-plan-cta"
        style={{ background: ctaBg, color: ctaInk, borderColor: ctaBorder }}
        onClick={(e) => {
          e.stopPropagation();
          onChoose();
        }}
      >
        {forInstitutes ? "Apply for this plan" : `Choose ${plan.name}`}
      </button>
      <div className="vh-plan-features">
        {(plan.features ?? []).map((feature) => (
          <div className="vh-plan-feature" style={{ color: featureInk }} key={feature}>
            <span className="vh-plan-check" style={{ background: checkBg, color: checkInk }}>
              <CheckIcon />
            </span>
            <span>{feature}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Plans() {
  useSEO({ title: "Plans & Pricing", description: "Direct student subscriptions and institute partnerships — priced honestly, billed monthly or annual, cancel anytime." });
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);
  const contactSettings = useContactSettings();
  const { handleAuth, showInstituteBanner, closeInstituteBanner, goToMyCourses } = usePublicAuthAction();
  const rootRef = useRef<HTMLDivElement | null>(null);
  useRevealOnScroll(rootRef);

  const [payload, setPayload] = useState<LandingPlansPayload | null>(null);
  const [failed, setFailed] = useState(false);
  const [audience, setAudienceState] = useState<Audience | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [faqOpen, setFaqOpen] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<LandingPlansPayload>("/plans", { headers: { "X-Skip-Loader": "true" } })
      .then(({ data }) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) {
          setPayload({ show_direct: true, show_institutes: false, direct_students: [], institutes: [] });
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showStudentPlans = payload?.show_direct ?? false;
  const showInstitutePlans = payload?.show_institutes ?? false;
  const studentPlans = payload?.direct_students ?? [];
  const institutePlans = payload?.institutes ?? [];
  const anyCatalogueShown = showStudentPlans || showInstitutePlans;

  const audiencePlans = useCallback(
    (aud: Audience) => (aud === "institutes" ? (showInstitutePlans ? institutePlans : []) : showStudentPlans ? studentPlans : []),
    [showInstitutePlans, institutePlans, showStudentPlans, studentPlans],
  );

  useEffect(() => {
    if (!payload || audience !== null) return;
    const initialAudience: Audience = showStudentPlans || !showInstitutePlans ? "students" : "institutes";
    const plans = audiencePlans(initialAudience);
    setAudienceState(initialAudience);
    setBilling(plans.some((p) => p.billing_period === "monthly") ? "monthly" : "annual");
  }, [payload, audience, showStudentPlans, showInstitutePlans, audiencePlans]);

  function selectAudience(next: Audience) {
    if (audience === next) return;
    const plans = audiencePlans(next);
    const nextBilling: Billing = plans.some((p) => p.billing_period === billing) ? billing : plans.some((p) => p.billing_period === "monthly") ? "monthly" : "annual";
    setAudienceState(next);
    setBilling(nextBilling);
    setSelectedPlanId(null);
  }

  function setMonthly() {
    setBilling("monthly");
    setSelectedPlanId(null);
  }
  function setAnnual() {
    setBilling("annual");
    setSelectedPlanId(null);
  }

  function applyForInstitute(planId: number) {
    navigate(planId ? `/contact?plan=${planId}` : "/contact");
  }

  const goAuth = () => navigate(user ? destinationFor(user) ?? "/" : "/login");

  const cataloguePlans = audience ? audiencePlans(audience) : [];
  const showBillingToggle = cataloguePlans.some((p) => p.billing_period === "monthly") && cataloguePlans.some((p) => p.billing_period === "annual");
  const visiblePlans = showBillingToggle ? cataloguePlans.filter((p) => p.billing_period === billing || p.billing_period === "custom") : cataloguePlans;
  const pending = payload === null || audience === null;
  const hasPlans = !pending && visiblePlans.length > 0;
  const showEmptyState = !pending && visiblePlans.length === 0;
  const planGridClass = `vh-plan-grid${visiblePlans.length < 3 ? " vh-plan-grid-few" : ""}`;

  const emptyTitle = failed ? "Pricing is temporarily unavailable" : anyCatalogueShown ? "Pricing is being finalised" : "Pricing is available on request";
  const emptyBody = failed
    ? "We could not load our plans just now. Please refresh in a moment, or contact us and we will walk you through the options."
    : anyCatalogueShown
      ? "No plans are published yet. Get in touch and our team will put together the right package for you."
      : "We do not list our pricing publicly right now. Contact our team and we will share the plan details that fit you — whether you are studying on your own or running an institute.";

  return (
    <div className="vh-public" ref={rootRef}>
      <PublicOrbBackground />
      <div className="vh-page-content">
        <PublicHeader />

        <section className="vh-page-hero">
          <h1>
            Plans and <span className="vh-accent">vouchers</span>
          </h1>
          <p>Choose your LanguageCert preparation plan or book official exam seats with discounted vouchers.</p>
        </section>

        <section className="vh-plans-section vh-reveal">
          <div className="vh-pill-toggle-row">
            <SegmentedControl<Audience>
              ariaLabel="Target audience"
              value={audience || "students"}
              onChange={(val) => selectAudience(val)}
              neverCollapse
              options={[
                { label: "For Students", value: "students" },
                { label: "For Institutes", value: "institutes" },
              ]}
            />
          </div>

          {showBillingToggle && (
            <div className="vh-pill-toggle-row vh-pill-toggle-row-billing">
              <SegmentedControl<Billing>
                ariaLabel="Billing cycle"
                value={billing}
                onChange={(val) => (val === "annual" ? setAnnual() : setMonthly())}
                neverCollapse
                options={[
                  { label: "Monthly", value: "monthly" },
                  { label: "Annual", value: "annual" },
                ]}
              />
            </div>
          )}

          {hasPlans && (
            <div className={planGridClass}>
              {visiblePlans.map((plan) => {
                const featured = selectedPlanId !== null ? selectedPlanId === plan.id : Boolean(plan.is_popular);
                return (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    featured={featured}
                    onSelect={() => setSelectedPlanId(plan.id)}
                    onChoose={() => (plan.audience === "institutes" ? applyForInstitute(plan.id) : handleAuth("register", plan.id))}
                  />
                );
              })}
            </div>
          )}

          {showEmptyState && (
            <div className="vh-plan-empty">
              <strong>{emptyTitle}</strong>
              <span>{emptyBody}</span>
              {!anyCatalogueShown && (
                <Link to="/contact" className="vh-plan-empty-cta">
                  Contact our team →
                </Link>
              )}
            </div>
          )}
        </section>

        <VouchersSection />

        <section className="vh-faq-section vh-reveal">
          <div className="vh-faq-intro">

            <h2>Common questions</h2>
          </div>
          <div className="vh-acc">
            {FAQS.map((faq, i) => (
              <div className={`vh-acc-item${faqOpen === i ? " vh-acc-open" : ""}`} key={faq.q}>
                <button type="button" className="vh-acc-trigger" aria-expanded={faqOpen === i} onClick={() => setFaqOpen((current) => (current === i ? -1 : i))}>
                  <span>{faq.q}</span>
                  <span className="vh-acc-icon" aria-hidden="true" />
                </button>
                <div className="vh-acc-panel">
                  <div className="vh-acc-panel-inner">
                    <div className="vh-acc-body">{faq.a}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <PublicCtaBanner
          heading="Not sure which plan fits?"
          body="Book a 15-minute call. We will match you to a plan based on your student count and goals."
          primary={{ label: user ? "Go to dashboard →" : "Sign in to portal →", onClick: goAuth }}
          secondary={{ label: "Talk to sales", href: "/contact" }}
        />

        <PublicFooter socialLinks={contactSettings?.social_links} />
      </div>

      {showInstituteBanner && <InstitutePlanBanner publicTheme={theme} onClose={closeInstituteBanner} onGoToCourses={goToMyCourses} />}
    </div>
  );
}
