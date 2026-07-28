import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import "../Button/Button.css";
import "./LinkButton.css";
import type { ButtonSize, ButtonVariant } from "../Button/Button";

interface LinkButtonBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** In-app navigation — routed by react-router. */
export interface RouterLinkButtonProps extends LinkButtonBaseProps, Omit<LinkProps, "className" | "children"> {
  href?: never;
}

/** Escape hatch for targets the router cannot own: `mailto:`, `tel:`, externals. */
export interface AnchorLinkButtonProps
  extends LinkButtonBaseProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children"> {
  href: string;
  to?: never;
}

export type LinkButtonProps = RouterLinkButtonProps | AnchorLinkButtonProps;

/**
 * A link that looks exactly like a `Button`.
 *
 * Deliberately reuses `Button.css` rather than restating the button look, so
 * navigation actions ("New Plan", "New Coupon", "Contact us") and real buttons
 * can never drift apart. Only the anchor-specific resets live in LinkButton.css.
 *
 * Renders a router `<Link>` for `to`, or a plain `<a>` for `href` — the latter
 * covers `mailto:` targets that react-router must not intercept.
 *
 * Replaces the hand-rolled `.button-link` class previously applied across the
 * dashboards; because its appearance comes from `--primary`, it follows the
 * portal's sidebar color automatically.
 */
export function LinkButton(props: LinkButtonProps) {
  const {
    variant = "primary",
    size = "md",
    fullWidth = false,
    leftIcon,
    rightIcon,
    className = "",
    children,
    ...rest
  } = props;

  const classes = [
    "ui-btn",
    "ui-link-btn",
    `ui-btn-${variant}`,
    `ui-btn-${size}`,
    fullWidth ? "ui-btn-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {leftIcon && <span className="ui-btn-icon ui-btn-icon-left">{leftIcon}</span>}
      <span className="ui-btn-label">{children}</span>
      {rightIcon && <span className="ui-btn-icon ui-btn-icon-right">{rightIcon}</span>}
    </>
  );

  if ("href" in rest && rest.href !== undefined) {
    return (
      <a className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {content}
      </a>
    );
  }

  return (
    <Link className={classes} {...(rest as Omit<LinkProps, "className" | "children">)}>
      {content}
    </Link>
  );
}
