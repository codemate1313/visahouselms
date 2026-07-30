import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import type { LinkProps } from "react-router-dom";
import { Button, type ButtonSize, type ButtonVariant } from "../Button";
import { LinkButton } from "../LinkButton";
import "./DashboardButton.css";

interface DashboardButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export interface DashboardActionButtonProps
  extends DashboardButtonBaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "type"> {
  type?: "button" | "submit" | "reset";
  href?: never;
  to?: never;
}

export interface DashboardRouterButtonProps
  extends DashboardButtonBaseProps,
    Omit<LinkProps, "className" | "children"> {
  href?: never;
}

export interface DashboardAnchorButtonProps
  extends DashboardButtonBaseProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> {
  href: string;
  to?: never;
}

export type DashboardButtonProps =
  | DashboardActionButtonProps
  | DashboardRouterButtonProps
  | DashboardAnchorButtonProps;

export function DashboardButton(props: DashboardButtonProps) {
  const className = ["dashboard-btn", props.className].filter(Boolean).join(" ");

  if ("to" in props && props.to !== undefined) {
    const { className: _className, ...rest } = props;
    return <LinkButton className={className} {...rest} />;
  }

  if ("href" in props && props.href !== undefined) {
    const { className: _className, ...rest } = props;
    return <LinkButton className={className} {...rest} />;
  }

  const { className: _className, ...rest } = props;
  return <Button className={className} {...rest} />;
}
