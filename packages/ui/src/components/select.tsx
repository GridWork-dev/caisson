import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

import "./select.css";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> {
  options: readonly SelectOption[];
  /** Non-selectable leading hint rendered as a disabled empty option. */
  placeholder?: string;
  /** Marks the control invalid (`aria-invalid` + danger chrome). */
  invalid?: boolean;
}

/**
 * Select — a styled wrapper over the native `<select>`, so keyboard interaction, the native option
 * list, type-ahead, and mobile pickers come for free (the free line). A caret glyph is drawn by CSS;
 * the real control stays the native element. `aria-label` (or a wiring `<label>`) names it. The
 * autocomplete/typeahead combobox is a heavier variant left to the commercial tier.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { options, placeholder, invalid = false, className, ...rest },
    ref,
  ) {
    return (
      <div
        className={className ? `cs-select ${className}` : "cs-select"}
        data-invalid={invalid ? "" : undefined}
      >
        <select
          ref={ref}
          className="cs-select__control"
          aria-invalid={invalid || undefined}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="cs-select__caret" aria-hidden="true" />
      </div>
    );
  },
);
