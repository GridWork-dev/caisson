import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

import { Icon } from "./icon";

import "./toast.css";

export type ToastTone = "info" | "success" | "warning" | "danger";

const TONE_ICON: Record<
  ToastTone,
  "info" | "check" | "alert-triangle" | "alert"
> = {
  info: "info",
  success: "check",
  warning: "alert-triangle",
  danger: "alert",
};

export interface ToastProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "title"
> {
  tone?: ToastTone;
  /** Optional heading above the message. */
  title?: ReactNode;
  children: ReactNode;
  /** Render a dismiss button that calls this. */
  onDismiss?: () => void;
}

/**
 * Toast — a single transient notification. `danger`/`warning` announce assertively (`role="alert"`),
 * info/success politely (`role="status"`). Presentational + server-safe: the queue and auto-dismiss
 * timers are the app's concern; mount toasts inside a `ToastRegion` so they share one live region.
 */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  { tone = "info", title, children, onDismiss, className, ...rest },
  ref,
) {
  const assertive = tone === "danger" || tone === "warning";
  return (
    <div
      ref={ref}
      className={className ? `cs-toast ${className}` : "cs-toast"}
      data-tone={tone}
      role={assertive ? "alert" : "status"}
      {...rest}
    >
      <Icon name={TONE_ICON[tone]} className="cs-toast__icon" />
      <div className="cs-toast__content">
        {title ? <p className="cs-toast__title">{title}</p> : null}
        <div className="cs-toast__message">{children}</div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          className="cs-toast__dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <Icon name="x" />
        </button>
      ) : null}
    </div>
  );
});

export interface ToastRegionProps extends HTMLAttributes<HTMLDivElement> {
  /** Screen edge to anchor the stack. Default bottom-right. */
  placement?: "top" | "bottom";
  children: ReactNode;
}

/**
 * ToastRegion — the fixed, aria-live container that holds a toast stack. One `aria-live="polite"`
 * region so stacked toasts are announced in order without each one owning a live region.
 */
export const ToastRegion = forwardRef<HTMLDivElement, ToastRegionProps>(
  function ToastRegion(
    { placement = "bottom", children, className, ...rest },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={
          className ? `cs-toast-region ${className}` : "cs-toast-region"
        }
        data-placement={placement}
        aria-live="polite"
        aria-relevant="additions"
        {...rest}
      >
        {children}
      </div>
    );
  },
);
