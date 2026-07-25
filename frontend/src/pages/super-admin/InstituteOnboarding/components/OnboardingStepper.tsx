import { instituteOnboardingStrings as strings } from "../InstituteOnboarding.strings";

interface OnboardingStepperProps {
  step: number;
}

export function OnboardingStepper({ step }: OnboardingStepperProps) {
  return (
    <div className="onboarding-stepper-card">
      <ol className="onboarding-steps">
        {strings.steps.map((label, index) => (
          <li className={step === index + 1 ? "active" : step > index + 1 ? "complete" : ""} key={label}>
            <span>{step > index + 1 ? "✓" : index + 1}</span>
            <span className="step-label-text">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
