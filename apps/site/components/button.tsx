import { Button as KitButton } from "@caisson/ui/components";
import type { ButtonProps as KitButtonProps } from "@caisson/ui/components";
import Link from "next/link";
import type { ReactNode } from "react";

export interface ButtonProps extends Omit<KitButtonProps, "asChild"> {
  /** Internal route, hash anchor, or (with `external`) an absolute/mailto URL. Omit for a real
   *  `<button>` (e.g. an onClick action). */
  href?: string;
  /** Render the link as a plain `<a>` (mailto:, external URLs, static files) instead of `next/link`. */
  external?: boolean;
  children: ReactNode;
}

/**
 * Site Button — the Next navigation seam over the framework-agnostic kit `Button` (ADR-0097): the kit
 * never imports `next/link`, so the app injects it here via `asChild`. `href` → `<Link>` (or a plain
 * `<a>` when `external`); no `href` → a real `<button>`. The kit owns all styling (`cs-button` +
 * `data-variant`/`data-size`); this wrapper only wires routing so pages keep `<Button href variant>`.
 */
export function Button({ href, external, children, ...rest }: ButtonProps) {
  if (href === undefined) {
    return <KitButton {...rest}>{children}</KitButton>;
  }
  if (external) {
    return (
      <KitButton asChild {...rest}>
        <a href={href} rel="noreferrer">
          {children}
        </a>
      </KitButton>
    );
  }
  return (
    <KitButton asChild {...rest}>
      <Link href={href}>{children}</Link>
    </KitButton>
  );
}
