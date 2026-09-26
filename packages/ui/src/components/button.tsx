import { Slot } from "radix-ui";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import "./button.css";

export type ButtonVariant = "primary" | "ghost";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual weight: `primary` = accent fill (one of the ≤10% accent slots), `ghost` = hairline. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Render as the single child element instead of a `<button>` (Radix Slot). This is the
   * framework-agnostic navigation seam: a Next consumer writes
   * `<Button asChild><Link href="/x">…</Link></Button>` so `@caisson-sh/ui` never imports `next/link`.
   * The child must accept `className` + `data-*` (Slot merges the kit's props onto it).
   */
  asChild?: boolean;
  children?: ReactNode;
}

/**
 * Button — a primary or ghost action control with small/medium sizing and optional Radix Slot
 * polymorphism. Recipe REFERENCE component (ADR-0099) — the template every other kit primitive
 * copies:
 *   1. Radix behavior/polymorphism (here `Slot` for `asChild`); never a framework import.
 *   2. Co-located plain CSS (`button.css`) reading only `var(--cs-*)`.
 *   3. Variants as `data-*` attributes styled by attribute selectors — no variant logic in JS;
 *      light/dark "just works" by cascade.
 *   4. `forwardRef`, BEM block name `cs-button`.
 *
 * @a11y Native buttons default to `type="button"` to prevent accidental form submission; with
 *   `asChild`, the caller owns the slotted element's native semantics and accessible name.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      asChild = false,
      className,
      type,
      children,
      ...rest
    },
    ref,
  ) {
    const Comp = (asChild ? Slot.Root : "button") as React.ElementType;
    // A bare <button> defaults to type="submit"; pin "button" unless told otherwise. Omitted under
    // asChild (the slotted child — e.g. an <a> — has no `type`), avoiding an explicit `undefined`
    // under exactOptionalPropertyTypes.
    const nativeType = asChild ? {} : { type: type ?? "button" };
    return (
      <Comp
        ref={ref}
        className={className ? `cs-button ${className}` : "cs-button"}
        data-variant={variant}
        data-size={size}
        {...nativeType}
        {...rest}
      >
        {children}
      </Comp>
    );
  },
);
