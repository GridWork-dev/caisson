"use client";

import { Icon } from "@caisson/ui/components";

import { useCart } from "./cart-provider";

/** The always-visible nav cart button — toggles the drawer, shows the line count as a badge once
 *  non-zero. Sits outside the desktop-only `.navCtas` group and the mobile drawer so it stays
 *  visible at every breakpoint (`components/site-nav.tsx`). */
export function CartTrigger() {
  const { items, toggleDrawer } = useCart();
  const count = items.length;

  return (
    <button
      type="button"
      onClick={toggleDrawer}
      aria-label={
        count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart"
      }
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "2.25rem",
        height: "2.25rem",
        borderRadius: "var(--cs-radius-md)",
        border: "1px solid var(--cs-border)",
        background: "transparent",
        color: "var(--cs-fg)",
        cursor: "pointer",
      }}
    >
      <Icon name="cart" />
      {count > 0 && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "-0.35rem",
            right: "-0.35rem",
            minWidth: "1.1rem",
            height: "1.1rem",
            padding: "0 0.3rem",
            borderRadius: "999px",
            background: "var(--cs-accent)",
            color: "var(--cs-bg)",
            fontSize: "var(--cs-text-xs)",
            fontFamily: "var(--cs-font-mono)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
