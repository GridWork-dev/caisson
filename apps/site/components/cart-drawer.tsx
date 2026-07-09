"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@caisson/ui/components";

import { Button } from "@/components";
import { formatUsd } from "@/lib/pricing";

import { useCart } from "./cart-provider";
import {
  CartLineItem,
  CartPrunedNotice,
  CartTrustNote,
  CartUpgradeCallout,
} from "./cart-shared";
import styles from "./cart.module.css";

/** Slide-out cart summary, mounted once in the marketing layout and toggled by `CartTrigger`. A
 *  fast glance + remove + honest bundle nudge — the full review + checkout lives on `/cart` (D-5,
 *  ADR-0193). Built on a native `<dialog>` opened with `showModal()`, which supplies the focus
 *  trap, Escape-to-close, inert background, and focus-return the hand-rolled `role="dialog"` div
 *  lacked (the D-6 gap, WCAG 2.4.11 / 2.1.2). */
export function CartDrawer() {
  const { items, subtotal, drawerOpen, closeDrawer } = useCart();
  const ref = useRef<HTMLDialogElement>(null);

  // Drive the native dialog from provider state. showModal()/close() are idempotent-guarded so the
  // dialog's own `close` event (Escape) → closeDrawer() → this effect is a no-op, not a loop.
  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (drawerOpen && !dlg.open) dlg.showModal();
    else if (!drawerOpen && dlg.open) dlg.close();
  }, [drawerOpen]);

  return (
    <dialog
      ref={ref}
      className={styles.drawer}
      aria-label="Cart"
      onClose={closeDrawer}
      onClick={(e) => {
        // A click landing on the dialog element itself is a backdrop click (panel clicks have an
        // inner target and stop here).
        if (e.target === ref.current) closeDrawer();
      }}
    >
      <div className={styles.panel}>
        <div className={styles.header}>
          <span className="cs-card-title">Cart</span>
          <button
            type="button"
            className={styles.close}
            aria-label="Close cart"
            onClick={closeDrawer}
          >
            <Icon name="x" />
          </button>
        </div>

        <CartPrunedNotice />

        {items.length === 0 ? (
          <p className="cs-muted">
            Your cart is empty. Add a bundle or a module to get started.
          </p>
        ) : (
          <>
            <ul className={styles.lines}>
              {items.map((item) => (
                <CartLineItem key={item.id} item={item} density="compact" />
              ))}
            </ul>

            <CartUpgradeCallout />

            <div className={styles.subtotal}>
              <span
                className="cs-muted"
                style={{ fontSize: "var(--cs-text-sm)" }}
              >
                Subtotal
              </span>
              <span className={`cs-num ${styles.subtotalNum}`}>
                {formatUsd(subtotal)}
              </span>
            </div>

            <CartTrustNote />

            <Button href="/cart" variant="primary" onClick={closeDrawer}>
              Review cart
            </Button>
          </>
        )}
      </div>
    </dialog>
  );
}
