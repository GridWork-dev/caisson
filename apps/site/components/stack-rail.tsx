"use client";

import { Button, Icon } from "@/components";
import { useCart } from "@/components/cart-provider";
import { bundleCatalogItem, toCartItem } from "@/lib/catalog";
import { type BundleId, buildStackSummary, formatUsd } from "@/lib/pricing";

import styles from "./marketplace.module.css";

/** Strip the `module:` / `bundle:` cart namespace back to the bare slug. */
function slugOf(id: string, kind: string): string {
  return id.slice(kind.length + 1);
}

/**
 * The persistent cart-aware "Your stack" rail (ADR-0285 §1) — Build-your-stack dissolved into the
 * surface. Reads the ONE cart (`cart-provider`, localStorage-backed), so a card's Add-to-cart and
 * this rail are never two parallel selections: it itemises the live cart, shows the running total,
 * surfaces the cheapest covering bundle (`buildStackSummary`), and routes to checkout. The bundle
 * nudge swaps the covered module lines for the bundle in place (no double coverage / overpay).
 */
export function StackRail() {
  const { items, subtotal, removeItem, replaceCart } = useCart();

  const moduleSlugs = items
    .filter((i) => i.kind === "module")
    .map((i) => slugOf(i.id, "module"));
  const bundleSlugs = items
    .filter((i) => i.kind === "bundle")
    .map((i) => slugOf(i.id, "bundle"));
  const summary = buildStackSummary(moduleSlugs, bundleSlugs);
  const { upgrade } = summary;

  // Swap the covered modules for the covering bundle: drop every module line (the upgrade only
  // qualifies when the bundle covers ALL of them), keep existing bundle lines, and add the target
  // once. addItem's drawer-open would pop a modal over the surface, so this uses the in-place
  // replaceCart instead.
  const addUpgrade = (target: BundleId) => {
    const item = bundleCatalogItem(target);
    if (!item) return;
    const kept = items.filter(
      (i) => i.kind === "bundle" && i.id !== `bundle:${target}`,
    );
    replaceCart([...kept, toCartItem(item)]);
  };

  const body =
    items.length === 0 ? (
      <div className={styles.railEmpty}>
        <Icon name="inbox" size="lg" />
        <p>
          Nothing in your stack yet. Add a module or a bundle to see the running
          total — and any bundle that would cover your picks for less.
        </p>
      </div>
    ) : (
      <>
        <ul className={styles.lines}>
          {items.map((i) => (
            <li key={i.id} className={styles.lineItem}>
              <span className={styles.lineLabel}>{i.label}</span>
              <span className={styles.linePrice}>{formatUsd(i.amount)}</span>
              <button
                type="button"
                className={styles.remove}
                onClick={() => removeItem(i.id)}
                aria-label={`Remove ${i.label}`}
              >
                <Icon name="x" />
              </button>
            </li>
          ))}
        </ul>

        <div className={styles.totalRow} role="status" aria-live="polite">
          <span>Total</span>
          <span className={styles.totalNum}>{formatUsd(subtotal)}</span>
        </div>

        {upgrade && (
          <div className={styles.upgrade}>
            <p>
              Your modules add up to {formatUsd(summary.total)} — the{" "}
              {upgrade.label} covers them for {formatUsd(upgrade.price)}. Save{" "}
              {formatUsd(upgrade.saves)}.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={() => addUpgrade(upgrade.target)}
            >
              Add {upgrade.label} instead
            </Button>
          </div>
        )}

        <Button href="/cart" variant="primary">
          Review &amp; check out
        </Button>
      </>
    );

  return (
    <>
      <aside className={styles.rail} aria-label="Your stack">
        <span className={styles.railTitle}>Your stack</span>
        {body}
      </aside>

      {/* Mobile bottom dock (< 900px, ADR-0374 675b100583dd38f8): a native <details> summary bar
          pinned to the viewport bottom — always shows the running total — that expands the same
          itemised body upward on tap, instead of the desktop rail trailing below all the catalog
          cards with no sticky total. Always rendered; CSS-only visibility (no hydration mismatch,
          the mobile-buy-bar.css convention). */}
      <details className={styles.stackDock} data-stack-dock="">
        <summary className={styles.stackDockSummary}>
          <span className={styles.stackDockLabel}>
            <span className={styles.railTitle}>Your stack</span>
            {items.length > 0 && (
              <span
                className="cs-num"
                style={{
                  fontSize: "var(--cs-text-xs)",
                  color: "var(--cs-fg-muted)",
                }}
              >
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            )}
          </span>
          {/* aria-live on the always-visible total: with the dock collapsed, an add/remove
              must still announce the new running total (WCAG 4.1.3) — the body's own live
              region only exists while the details is expanded. */}
          <span
            className={`cs-num ${styles.totalNum}`}
            aria-live="polite"
            aria-atomic="true"
          >
            {formatUsd(subtotal)}
          </span>
          <span className={styles.stackDockChevron} aria-hidden="true" />
        </summary>
        <div className={styles.stackDockBody}>{body}</div>
      </details>
    </>
  );
}
