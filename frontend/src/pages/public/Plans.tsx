import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { LandingPlan, LandingPlansPayload, PricingLocation } from "./Plans.types";
import { SegmentedControl } from "@/components/ui";
import { Button } from "@/components/ui/Button/Button";
import { motion, AnimatePresence } from "framer-motion";
import NumberFlow from "@number-flow/react";
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

interface DisplayPrice {
  amount: number;
  currency: string;
  isConverted: boolean;
}

function getDisplayPrice(plan: LandingPlan, location: PricingLocation | null): DisplayPrice {
  const baseAmount = Number(plan.price);
  const baseCurrency = plan.currency || "INR";
  if (location?.default_currency !== "USD") {
    return { amount: baseAmount, currency: baseCurrency, isConverted: false };
  }

  const configuredUsd = Number(plan.usd_price);
  if (plan.is_international_enabled && plan.usd_price != null && plan.usd_price !== "" && Number.isFinite(configuredUsd)) {
    return { amount: configuredUsd, currency: "USD", isConverted: false };
  }

  const rate = Number(location.conversion?.rate);
  if (baseCurrency.toUpperCase() === "INR" && Number.isFinite(baseAmount) && Number.isFinite(rate) && rate > 0) {
    return { amount: baseAmount * rate, currency: "USD", isConverted: true };
  }

  return { amount: baseAmount, currency: baseCurrency, isConverted: false };
}

function formatPrice(display: DisplayPrice) {
  const { amount, currency } = display;
  if (!Number.isFinite(amount)) return "";
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(currency === "INR" ? "en-IN" : "en-US")}`;
  }
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function RollingPrice({ display, planId }: { display: DisplayPrice; planId: number }) {
  const { amount, currency } = display;
  const [displayAmount, setDisplayAmount] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(amount)) return undefined;

    setDisplayAmount(0);
    const frame = requestAnimationFrame(() => {
      setDisplayAmount(amount);
    });

    return () => cancelAnimationFrame(frame);
  }, [amount, planId]);

  if (!Number.isFinite(amount)) return <>{formatPrice(display)}</>;

  return (
    <NumberFlow
      value={displayAmount}
      format={{
        style: "currency",
        currency,
        maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      }}
      isolate
      transformTiming={{
        duration: 300,
        easing: "ease-out",
      }}
      spinTiming={{
        duration: 520,
        easing: "ease-out",
      }}
      willChange
    />
  );
}

function PlanCard({
  plan,
  isPopular,
  isSelected,
  location,
  onSelect,
  onChoose,
}: {
  plan: LandingPlan;
  isPopular: boolean;
  isSelected: boolean;
  location: PricingLocation | null;
  onSelect: () => void;
  onChoose: () => void;
}) {
  const forInstitutes = plan.audience === "institutes";
  const display = getDisplayPrice(plan, location);
  const cardBg = isPopular
    ? "linear-gradient(155deg, var(--ac), var(--ac2))"
    : isSelected
      ? "var(--card-hover, rgba(255, 255, 255, 0.05))"
      : "var(--card)";
  const cardInk = isPopular ? "#fff" : "var(--ink)";
  const cardBorder = isPopular
    ? "transparent"
    : isSelected
      ? "2px solid var(--ac)"
      : "1px solid var(--line)";
  const cardShadow = isPopular
    ? "0 30px 60px -24px var(--ac)"
    : isSelected
      ? "0 12px 32px -12px var(--ac)"
      : "none";
  const mutedInk = isPopular ? "rgba(255,255,255,0.86)" : "var(--ink2)";
  const featureInk = isPopular ? "rgba(255,255,255,0.95)" : "var(--ink)";
  const ctaBg = isPopular ? "#fff" : "var(--ac)";
  const ctaInk = isPopular ? "var(--ac)" : "#fff";
  const ctaBorder = "transparent";
  const ctaShadow = isPopular ? "0 8px 20px -6px rgba(0, 0, 0, 0.2)" : "0 10px 24px -10px var(--ac)";
  const checkBg = isPopular ? "rgba(255,255,255,0.22)" : "var(--acWash)";
  const checkInk = isPopular ? "#fff" : "var(--ac)";

  return (
    <div
      className="vh-plan-card vh-reveal"
      style={{ background: cardBg, color: cardInk, border: cardBorder, boxShadow: cardShadow }}
      onClick={onSelect}
    >
      {isPopular && <div className="vh-plan-badge">Popular Choice</div>}
      <div className="vh-plan-name" style={{ color: mutedInk }}>
        {plan.name}
      </div>
      <div className="vh-plan-price-row">
        <span className="vh-plan-price">
          <RollingPrice display={display} planId={plan.id} />
        </span>
        <span className="vh-plan-period" style={{ color: mutedInk }}>
          {plan.period_label}
        </span>
      </div>
      {display.isConverted ? <div className="vh-plan-price-note">Approx. USD converted from INR · billed in INR</div> : null}
      {plan.description && (
        <p className="vh-plan-desc" style={{ color: mutedInk }}>
          {plan.description}
        </p>
      )}
      <Button
        type="button"
        className="vh-plan-cta"
        data-force-color=""
        style={{
          background: ctaBg,
          borderColor: ctaBorder,
          boxShadow: ctaShadow,
          ["--ui-btn-color" as string]: ctaInk,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onChoose();
        }}
      >
        {forInstitutes ? "Apply for this plan" : `Choose ${plan.name}`}
      </Button>
      <div className="vh-plan-features">
        <AnimatePresence mode="popLayout">
          {(plan.features ?? []).map((feature, i) => (
            <motion.div
              key={`${plan.audience || "plan"}-${feature}-${i}`}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{
                duration: 0.35,
                delay: i * 0.04,
                ease: "easeOut",
              }}
              className="vh-plan-feature"
              style={{ color: featureInk }}
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 450,
                  damping: 18,
                  delay: i * 0.04 + 0.1,
                }}
                className="vh-plan-check"
                style={{ background: checkBg, color: checkInk }}
              >
                <CheckIcon />
              </motion.span>
              <span>{feature}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function Plans() {
  useSEO({ title: "Plans and Vouchers", description: "LanguageCert plans, institute packages and official exam vouchers in one place." });
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const theme = useThemeStore((state) => state.theme);
  const contactSettings = useContactSettings();
  const { handleAuth, showInstituteBanner, closeInstituteBanner, goToMyCourses } = usePublicAuthAction();
  const rootRef = useRef<HTMLDivElement | null>(null);
  useRevealOnScroll(rootRef);

  const [payload, setPayload] = useState<LandingPlansPayload | null>(null);
  const [pricingLocation, setPricingLocation] = useState<PricingLocation | null>(null);
  const [failed, setFailed] = useState(false);
  const [audience, setAudienceState] = useState<Audience | null>(null);
  const [billing, setBilling] = useState<Billing>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [faqOpen, setFaqOpen] = useState(-1);

  useEffect(() => {
    let cancelled = false;
    const plansRequest = apiClient.get<LandingPlansPayload>("/plans", { headers: { "X-Skip-Loader": "true" } });
    const locationRequest = apiClient
      .get<PricingLocation>("/plans/location", { headers: { "X-Skip-Loader": "true" } })
      .catch(() => null);

    Promise.all([plansRequest, locationRequest])
      .then(([plansResponse, locationResponse]) => {
        if (!cancelled) {
          setPayload(plansResponse.data);
          setPricingLocation(locationResponse?.data ?? null);
        }
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
  const studentPlans = useMemo(() => payload?.direct_students ?? [], [payload?.direct_students]);
  const institutePlans = useMemo(() => payload?.institutes ?? [], [payload?.institutes]);
  const anyCatalogueShown = showStudentPlans || showInstitutePlans;

  const audienceOptions = [
    ...(showStudentPlans ? [{ label: "For Students", value: "students" as Audience }] : []),
    ...(showInstitutePlans ? [{ label: "For Institutes", value: "institutes" as Audience }] : []),
  ];

  const audiencePlans = useCallback(
    (aud: Audience) => (aud === "institutes" ? (showInstitutePlans ? institutePlans : []) : showStudentPlans ? studentPlans : []),
    [showInstitutePlans, institutePlans, showStudentPlans, studentPlans],
  );

  useEffect(() => {
    if (!payload || audience !== null) return;
    const initialAudience: Audience = showStudentPlans ? "students" : showInstitutePlans ? "institutes" : "students";
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

  const effectiveAudience = audience && audienceOptions.some((o) => o.value === audience)
    ? audience
    : audienceOptions[0]?.value ?? null;

  const cataloguePlans = effectiveAudience ? audiencePlans(effectiveAudience) : [];
  const showBillingToggle = cataloguePlans.some((p) => p.billing_period === "monthly") && cataloguePlans.some((p) => p.billing_period === "annual");
  const visiblePlans = showBillingToggle ? cataloguePlans.filter((p) => p.billing_period === billing || p.billing_period === "custom") : cataloguePlans;
  const pending = payload === null;
  const hasPlans = !pending && visiblePlans.length > 0;
  // Plans exist for this audience overall, but the current billing filter
  // excludes all of them — distinct from the true "nothing published" case
  // below, and recoverable by resetting the filter rather than emailing support.
  const comboEmpty = !pending && !failed && cataloguePlans.length > 0 && visiblePlans.length === 0;
  const showEmptyState = !pending && !comboEmpty && (!anyCatalogueShown || visiblePlans.length === 0);
  const planGridClass = `vh-plan-grid${visiblePlans.length < 3 ? " vh-plan-grid-few" : ""}`;

  const emptyTitle = failed ? "Pricing is temporarily unavailable" : anyCatalogueShown ? "Pricing is being finalised" : "Pricing is available on request";
  const emptyBody = failed
    ? "We could not load our plans just now. Please refresh in a moment, or contact us and we will walk you through the options."
    : anyCatalogueShown
      ? "No plans are published yet. Get in touch and our team will put together the right package for you."
      : "We do not list our pricing publicly right now. Contact our team and we will share the plan details that fit you — whether you are studying on your own or running an institute.";

  function resetBillingFilter() {
    setBilling(cataloguePlans.some((p) => p.billing_period === "monthly") ? "monthly" : "annual");
    setSelectedPlanId(null);
  }

  return (
    <div className="vh-public" ref={rootRef}>
      <PublicOrbBackground />
      <div className="vh-page-content">
        <PublicHeader />

        <section className="vh-page-hero">
          <h1>
            Plans
            <span className="vh-accent"> and vouchers.</span>
          </h1>
          <p>Choose a LanguageCert preparation plan for students or institutes, then purchase official exam vouchers from the same page.</p>
        </section>

        <section className="vh-plans-section vh-reveal">
          {audienceOptions.length > 1 && (
            <div className="vh-pill-toggle-row">
              <SegmentedControl<Audience>
                ariaLabel="Target audience"
                value={effectiveAudience || "students"}
                onChange={(val) => selectAudience(val)}
                neverCollapse
                options={audienceOptions}
              />
            </div>
          )}

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
                const isPopular = Boolean(plan.is_popular);
                const isSelected = selectedPlanId === plan.id;
                return (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isPopular={isPopular}
                    isSelected={isSelected}
                    location={pricingLocation}
                    onSelect={() => setSelectedPlanId(plan.id)}
                    onChoose={() => (plan.audience === "institutes" ? applyForInstitute(plan.id) : handleAuth("register", plan.id))}
                  />
                );
              })}
            </div>
          )}

          {comboEmpty && (
            <div className="vh-plan-empty">
              <strong>No plans found for this combination</strong>
              <span>Try a different billing period, or reset the filter to see all available plans.</span>
              <Button type="button" variant="secondary" className="vh-plan-empty-cta" onClick={resetBillingFilter}>
                Reset filter
              </Button>
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

            <h2>FAQs</h2>
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
          heading="Ready to elevate your LanguageCert preparation?"
          body="Give your institute a LanguageCert advantage with digital assessments, performance insights and a better way to prepare students."
          primary={{ label: user ? "Go to dashboard →" : "Sign in to portal →", onClick: goAuth }}
          secondary={{ label: "Talk to sales", href: "/contact" }}
        />

        <PublicFooter socialLinks={contactSettings?.social_links} />
      </div>

      {showInstituteBanner && <InstitutePlanBanner publicTheme={theme} onClose={closeInstituteBanner} onGoToCourses={goToMyCourses} />}
    </div>
  );
}
