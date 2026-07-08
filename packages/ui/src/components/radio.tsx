import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import "./radio.css";

export interface RadioProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  /** Trailing label text/content. Omit to render the bare control. */
  label?: ReactNode;
}

/**
 * Radio — a hand-rolled radio button: a real `<input type="radio">` (semantics/keyboard/native
 * grouping via `name`) layered full-bleed over a decorative circle, with a CSS `:checked` sibling
 * selector drawing the filled dot — no JS state. Zero-Radix, zero dependencies (ADR-0291).
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; `forwardRef` onto the
 * real `<input>`; BEM block `cs-radio`. Presentational — the caller owns `checked`/`onChange` and
 * the shared `name` across a group, exactly like a native radio.
 */
export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, className, id, disabled, ...rest },
  ref,
) {
  const control = (
    <span className="cs-radio__control">
      <input
        ref={ref}
        type="radio"
        id={id}
        disabled={disabled}
        className="cs-radio__input"
        {...rest}
      />
      <span className="cs-radio__circle" aria-hidden="true">
        <span className="cs-radio__dot" />
      </span>
    </span>
  );

  if (label === undefined) {
    return (
      <span
        className={className ? `cs-radio ${className}` : "cs-radio"}
        data-disabled={disabled ? "" : undefined}
      >
        {control}
      </span>
    );
  }

  return (
    <label
      className={
        className
          ? `cs-radio cs-radio--labelled ${className}`
          : "cs-radio cs-radio--labelled"
      }
      data-disabled={disabled ? "" : undefined}
    >
      {control}
      <span className="cs-radio__label">{label}</span>
    </label>
  );
});
