import type { ReactNode } from "react";
import { Radio, type RadioProps } from "./Radio";

export interface RadioOption<T extends string> {
  description?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  value: T;
}

export interface RadioGroupProps<T extends string> {
  card?: boolean;
  className?: string;
  name: string;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  size?: RadioProps["size"];
  value: T;
}

export function RadioGroup<T extends string>({
  card = false,
  className = "",
  name,
  onChange,
  options,
  size = "md",
  value,
}: RadioGroupProps<T>) {
  return (
    <div className={`ui-radio-group${card ? " ui-radio-group-card" : ""}${className ? ` ${className}` : ""}`} role="radiogroup">
      {options.map((option) => (
        <Radio
          card={card}
          checked={option.value === value}
          description={option.description}
          icon={option.icon}
          key={option.value}
          label={option.label}
          name={name}
          onChange={() => onChange(option.value)}
          size={size}
          value={option.value}
        />
      ))}
    </div>
  );
}
