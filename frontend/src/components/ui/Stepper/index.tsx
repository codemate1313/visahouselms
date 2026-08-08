import React, { createContext, useContext } from "react";
import "./stepper.css";

interface StepperContextValue {
  value: number;
  orientation?: "horizontal" | "vertical";
}

const StepperContext = createContext<StepperContextValue>({ value: 1, orientation: "vertical" });

interface StepperItemContextValue {
  step: number;
}

const StepperItemContext = createContext<StepperItemContextValue>({ step: 1 });

export interface StepperProps {
  value: number;
  orientation?: "horizontal" | "vertical";
  children: React.ReactNode;
  className?: string;
}

export function Stepper({ value, orientation = "vertical", children, className = "" }: StepperProps) {
  return (
    <StepperContext.Provider value={{ value, orientation }}>
      <div className={`ui-stepper ui-stepper-${orientation} ${className}`}>
        {children}
      </div>
    </StepperContext.Provider>
  );
}

export interface StepperItemProps {
  step: number;
  children: React.ReactNode;
  className?: string;
}

export function StepperItem({ step, children, className = "" }: StepperItemProps) {
  const { value } = useContext(StepperContext);
  const status = step < value ? "completed" : step === value ? "active" : "inactive";

  return (
    <StepperItemContext.Provider value={{ step }}>
      <div className={`ui-stepper-item ui-stepper-item-${status} ${className}`} data-state={status} data-step={step}>
        {children}
      </div>
    </StepperItemContext.Provider>
  );
}

export interface StepperTriggerProps {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function StepperTrigger({ onClick, children, className = "" }: StepperTriggerProps) {
  return (
    <button type="button" onClick={onClick} className={`ui-stepper-trigger ${className}`}>
      {children}
    </button>
  );
}

export function StepperIndicator({ children }: { children?: React.ReactNode }) {
  const { value } = useContext(StepperContext);
  const { step } = useContext(StepperItemContext);
  const status = step < value ? "completed" : step === value ? "active" : "inactive";

  return (
    <div className={`ui-stepper-indicator ui-stepper-indicator-${status}`} data-state={status}>
      {children ? children : status === "completed" ? "✓" : step}
    </div>
  );
}

export function StepperTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`ui-stepper-title ${className}`}>{children}</div>;
}

export function StepperDescription({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`ui-stepper-description ${className}`}>{children}</div>;
}

export function StepperSeparator({ className = "" }: { className?: string }) {
  const { value } = useContext(StepperContext);
  const { step } = useContext(StepperItemContext);
  const isFilled = step < value;

  return (
    <div className={`ui-stepper-separator ${isFilled ? "is-filled" : ""} ${className}`}>
      <div className="ui-stepper-separator-line" />
    </div>
  );
}
