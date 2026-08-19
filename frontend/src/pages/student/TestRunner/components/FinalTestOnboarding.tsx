import { useState } from "react";
import type { Attempt } from "@/api/types";
import type { AuthUser } from "@/store/authStore";
import { buildExamUrn, formatExamBirthDate } from "../helpers";
import { PeopleCertBrand } from "./PeopleCertBrand";

interface FinalTestOnboardingProps {
  attempt: Attempt;
  user: AuthUser | null;
  securityError: string | null;
  securityStarting: boolean;
  concurrentTab: boolean;
  onStartSecureSession: () => void;
  onCancel: () => void;
}

/* The wording the delivery platform shows for the Academic paper. Authored
   onboarding instructions replace it when a module carries them, so a module
   with its own brief is not overwritten by this default. */
const DEFAULT_INSTRUCTIONS = [
  "Welcome to the LanguageCert Academic (Listening, Reading, Writing) exam.",
  "The exam consists of three sections: Listening, Reading and Writing.",
  "Please answer all questions. If you don't know the answer to a question, you can go to the next question and check your answers later.",
  "The listening section will start automatically. There are four parts which are heard twice. You will be moved through the listening section automatically.",
  "After the Listening section, you will start the Reading and Writing sections.",
  "Please note the timer displays the total time remaining for the Reading and Writing sections.",
  "You should spend 50 minutes on the Reading section and 50 minutes on the Writing section.",
  "Once you have moved to the Writing section you will not be able to return to the Listening and Reading sections.",
  "You will see a message when there are 15 minutes of the total time remaining.",
  "When you have completed the exam, you should click End Exam.",
];

/**
 * The Final Test's pre-exam sequence: verify details, read the brief, start.
 *
 * This replaces the standard onboarding for `final_test` only. It is not purely
 * informational - "Start Exam" is what triggers the secure session, so the
 * camera, microphone, screen-share and full-screen handshake still runs exactly
 * as before, just behind this sequence rather than the engine's own.
 */
export function FinalTestOnboarding({
  attempt,
  user,
  securityError,
  securityStarting,
  concurrentTab,
  onStartSecureSession,
  onCancel,
}: FinalTestOnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const urn = buildExamUrn(attempt, user?.id);
  const authored = (attempt.onboarding_instructions ?? [])
    .map((item) => item.description?.trim())
    .filter((line): line is string => Boolean(line));
  const instructions = authored.length > 0 ? authored : DEFAULT_INSTRUCTIONS;
  const minutes = attempt.duration_minutes;

  const fields: Array<{ label: string; hint?: string; value: string }> = [
    { label: "First / Middle Name(s)", hint: "(Latin)", value: user?.first_name || "—" },
    { label: "Last Name", hint: "(Latin)", value: user?.last_name || "—" },
    { label: "Birth Date", hint: "(DD/MM/YYYY)", value: formatExamBirthDate(user?.dob) },
    { label: "Module Name", value: attempt.module_title },
    { label: "URN", value: urn },
  ];

  return (
    <div className="test-runner-shell lc-exam lc-onboard">
      <header className="test-runner-header lc-header">
        <div className="lc-header-inner">
          <PeopleCertBrand />
          <h1 className="lc-header-title" />
          <div className="lc-header-right" />
        </div>
      </header>

      <div className="lc-onb-page">
        {step === 1 && (
          <section className="lc-onb-block" aria-labelledby="lc-onb-title-1">
            <h2 className="lc-onb-heading" id="lc-onb-title-1">Candidate Details Verification</h2>
            <div className="lc-onb-panel">
              <p className="lc-onb-strong">
                Please confirm your personal details shown below.
                <br />
                In the case of error, please inform your invigilator.
              </p>
              <p className="lc-onb-strong lc-onb-subheading">Personal Information</p>
              <dl className="lc-onb-fields">
                {fields.map((field) => (
                  <div className="lc-onb-field" key={field.label}>
                    <dt>
                      {field.label}
                      {field.hint && <span className="lc-onb-hint">{field.hint}</span>}
                    </dt>
                    <dd>{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <button type="button" className="lc-onb-button" onClick={() => setStep(2)}>Next</button>
            {/* Not on the delivery platform, which is entered through an
                invigilator. A candidate who opened the wrong paper here has no
                other way out that does not burn the sitting. */}
            <button type="button" className="lc-onb-exit" onClick={onCancel}>Return to my courses</button>
          </section>
        )}

        {step === 2 && (
          <section className="lc-onb-block" aria-labelledby="lc-onb-title-2">
            <h2 className="lc-onb-heading" id="lc-onb-title-2">Exam Instructions</h2>
            <div className="lc-onb-panel">
              <p className="lc-onb-strong lc-onb-panel-title">{attempt.module_title}</p>
              {instructions.map((line, index) => (
                <p className="lc-onb-line" key={index}>{line}</p>
              ))}
            </div>
            <button type="button" className="lc-onb-button" onClick={() => setStep(3)}>Next</button>
          </section>
        )}

        {step === 3 && (
          <section className="lc-onb-block" aria-labelledby="lc-onb-title-3">
            <h2 className="lc-onb-heading" id="lc-onb-title-3">Ready for the Exam</h2>
            <div className="lc-onb-panel">
              <p className="lc-onb-line">
                You have approximately <strong>{minutes ?? "—"}</strong> minutes to complete this exam.
              </p>
              <p className="lc-onb-line">Once you click &lsquo;Start Exam&rsquo; the exam time will start.</p>
            </div>
            {concurrentTab && (
              <p className="lc-onb-error" role="alert">Close the other Final Test tab before continuing.</p>
            )}
            {securityError && <p className="lc-onb-error" role="alert">{securityError}</p>}
            <button
              type="button"
              className="lc-onb-button"
              disabled={securityStarting || concurrentTab}
              onClick={onStartSecureSession}
            >
              {securityStarting ? "Starting…" : "Start Exam"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
