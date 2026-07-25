import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import "./switch.css";

export interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "type"
> {
  /** On/off state (controlled — the switch has no internal state, like the rest of the kit's
   * controlled primitives). */
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /**
   * Trailing label text/content, rendered INSIDE the button so it feeds the button's normal
   * accessible-name computation (a wrapping `<label>` is not reliably read by every AT for a
   * `role="switch"` button). Omit for an icon-only switch and pass `aria-label` instead.
   */
  label?: ReactNode;
}

/**
 * Switch — an on/off control for an immediate-effect setting (distinct from Checkbox, which is a
 * form-submission value). Implemented as `<button role="switch" aria-checked>` per the WAI-ARIA
 * Switch pattern (a `role="switch"` override on `<input type="checkbox">` is not reliably exposed
 * by every AT, so the APG recommends the button build for JS-driven switches). Zero-Radix, zero
 * dependencies (ADR-0291).
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; the semantic
 * `aria-checked` state also drives the thumb position/fill by attribute selector (with no redundant
 * `data-*` copy); `forwardRef` onto the single root `<button>`; BEM block `cs-switch`.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch(
    { checked, onCheckedChange, label, className, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        className={className ? `cs-switch ${className}` : "cs-switch"}
        onClick={() => onCheckedChange?.(!checked)}
        {...rest}
      >
        <span className="cs-switch__track" aria-hidden="true">
          <span className="cs-switch__thumb" />
        </span>
        {label !== undefined ? (
          <span className="cs-switch__label">{label}</span>
        ) : null}
      </button>
    );
  },
);
