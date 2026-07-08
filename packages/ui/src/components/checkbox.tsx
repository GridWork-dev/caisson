import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { Icon } from "./icon";
import "./checkbox.css";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  /** Trailing label text/content. Omit to render the bare control (caller supplies its own
   * `<label>`, e.g. wrapping a custom layout). */
  label?: ReactNode;
}

/**
 * Checkbox — a hand-rolled checkbox with a real `<input type="checkbox">` for semantics/keyboard
 * (layered full-bleed and transparent over the decorative box, so the whole ≥24px box is the hit
 * target) plus a CSS-driven check mark (`:checked` sibling selector — no JS state). Zero-Radix,
 * zero dependencies (ADR-0291): the "check" glyph reuses the kit's existing `<Icon>` surface.
 *
 * Recipe-compliant (ADR-0099): co-located CSS reading only `var(--cs-*)`; `forwardRef` onto the
 * real `<input>` (consistent with `Select`'s "ref → the native control" pattern); BEM block
 * `cs-checkbox`. Presentational — the caller owns `checked`/`onChange` like a native input.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox({ label, className, id, disabled, ...rest }, ref) {
    const control = (
      <span className="cs-checkbox__control">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          disabled={disabled}
          className="cs-checkbox__input"
          {...rest}
        />
        <span className="cs-checkbox__box" aria-hidden="true">
          <Icon name="check" className="cs-checkbox__check" />
        </span>
      </span>
    );

    if (label === undefined) {
      return (
        <span
          className={className ? `cs-checkbox ${className}` : "cs-checkbox"}
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
            ? `cs-checkbox cs-checkbox--labelled ${className}`
            : "cs-checkbox cs-checkbox--labelled"
        }
        data-disabled={disabled ? "" : undefined}
      >
        {control}
        <span className="cs-checkbox__label">{label}</span>
      </label>
    );
  },
);
