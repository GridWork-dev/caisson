import { Slot } from "radix-ui";
import { forwardRef, useId } from "react";
import type { HTMLAttributes, ReactElement, ReactNode } from "react";

import "./form-field.css";

export interface FormFieldProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** The field's visible label text. */
  label: ReactNode;
  /** Supporting copy shown under the control. Hidden while `error` is set — the error
   * takes its place so the two never compete for the same line. */
  helperText?: ReactNode;
  /** Validation failure message. Swaps in for `helperText`, marks the control
   * `aria-invalid`, and is announced via `role="alert"`. */
  error?: ReactNode;
  /** Render the control in the brand's control-ID monospace (Martian Mono, DESIGN.md §3)
   * — for id/key/token-shaped fields, not free-text notes. Default `false`. */
  mono?: boolean;
  /**
   * The single form control — an `<input>`, `<select>`, or `<textarea>`. It receives
   * `id`, `aria-describedby`, and `aria-invalid` via Radix `Slot` (the same seam
   * `Button`'s `asChild` uses) so the label and helper/error text associate correctly
   * for assistive tech without every call site wiring it by hand.
   */
  children: ReactElement;
}

/**
 * FormField — label + control + helper/error, the one shape the dashboard's hand-rolled
 * forms (BYOK key entry, add-a-seat, compliance attestation) all share. Consolidates the
 * duplicated inline `fieldStyle` objects those forms each re-declared.
 *
 * Recipe-compliant (ADR-0099): Radix `Slot` for the id/aria wiring (rule 1), co-located
 * CSS reading only `var(--cs-*)` (rule 2), `mono` as a `data-mono` attribute resolved by
 * a descendant selector (rule 3), `forwardRef` on the root, BEM block `cs-field`.
 * Presentational — the control itself stays whatever element the caller passes in.
 */
export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(
  function FormField(
    { label, helperText, error, mono, children, className, ...rest },
    ref,
  ) {
    const controlId = useId();
    const helperId = `${controlId}-helper`;
    const errorId = `${controlId}-error`;
    const describedBy =
      error !== undefined
        ? errorId
        : helperText !== undefined
          ? helperId
          : undefined;

    return (
      <div
        ref={ref}
        className={className ? `cs-field ${className}` : "cs-field"}
        data-mono={mono ? "" : undefined}
        {...rest}
      >
        <label className="cs-field__label" htmlFor={controlId}>
          {label}
        </label>
        <Slot.Root
          id={controlId}
          className="cs-field__control"
          aria-describedby={describedBy}
          aria-invalid={error !== undefined ? true : undefined}
        >
          {children}
        </Slot.Root>
        {error !== undefined ? (
          <p id={errorId} className="cs-field__error" role="alert">
            {error}
          </p>
        ) : helperText !== undefined ? (
          <p id={helperId} className="cs-field__helper">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
