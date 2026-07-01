"use client";

import { useEffect, useState } from "react";

import { Button, Icon } from "@/components";
import { useCart } from "@/components/cart-provider";
import {
  BUNDLE_CATALOG_ITEM,
  editionCatalogItem,
  moduleCatalogItem,
  toCartItem,
} from "@/lib/catalog";
import {
  buildStackSummary,
  EDITION_IDS,
  formatUsd,
  modulesByEdition,
  type EditionId,
} from "@/lib/pricing";

import { EDITION_ICON, editionLabel } from "./marketplace";
import styles from "./marketplace.module.css";

/**
 * Flagship stack configurator (ADR-0191). Left = the 14 modules as toggle rows grouped by edition;
 * right = a `position: sticky` running-total rail that itemises the selection, shows the live total,
 * and surfaces the cheapest covering upgrade (`buildStackSummary().upgrade`). Under 768px the rail
 * stops being a side column and the total + primary CTA move to a fixed bottom bar. The total is
 * announced through a debounced polite live region so a rapid multi-select doesn't spam a screen
 * reader (ADR-0194). Client island — the page shell stays a Server Component.
 */
export function StackBuilder() {
  const { addItem } = useCart();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const summary = buildStackSummary([...selected]);
  const { upgrade } = summary;

  const toggleModule = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // "Add to cart" adds every selected module (addCartItem dedups on id). addItem also opens the
  // drawer, so the last add gives the confirmation.
  const addSelectedToCart = () => {
    for (const line of summary.lineItems) {
      const item = moduleCatalogItem(line.id);
      if (item) addItem(toCartItem(item));
    }
  };

  // The upgrade nudge — add the whole edition or the bundle INSTEAD of the loose modules. Clearing
  // the picker is the "instead": it drops the redundant module lines so a following "Add to cart"
  // can't stack the edition on top of the modules it already covers (double coverage / overpay).
  const addUpgradeToCart = (target: EditionId | "bundle") => {
    const item =
      target === "bundle" ? BUNDLE_CATALOG_ITEM : editionCatalogItem(target);
    if (item) {
      addItem(toCartItem(item));
      setSelected(new Set());
    }
  };

  // Debounced polite announcement (ADR-0194): initialized empty, settles ~400ms after the last
  // toggle. The visible total updates instantly; only this sr-only region is debounced, so a burst
  // of selections announces once, not per keystroke.
  const announcement =
    summary.moduleCount === 0
      ? ""
      : `${summary.moduleCount} module${summary.moduleCount === 1 ? "" : "s"} selected. Running total ${formatUsd(summary.total)}.` +
        (upgrade
          ? ` The ${upgrade.label} covers them for ${formatUsd(upgrade.price)}, saving ${formatUsd(upgrade.saves)}.`
          : "");
  const [announced, setAnnounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(announcement), 400);
    return () => clearTimeout(t);
  }, [announcement]);

  const cta = (
    <Button
      type="button"
      variant="primary"
      onClick={addSelectedToCart}
      disabled={summary.moduleCount === 0}
    >
      Add to cart
    </Button>
  );

  return (
    <div className={styles.build}>
      {/* ===== Module picker ===== */}
      <div className={styles.picker}>
        {EDITION_IDS.map((e) => (
          <fieldset key={e} className={styles.pickerGroup}>
            <legend className={styles.pickerLegend}>
              <Icon name={EDITION_ICON[e]} />
              {editionLabel(e)}
            </legend>
            {modulesByEdition(e).map((m) => (
              <label key={m.id} className={styles.pickerRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selected.has(m.id)}
                  onChange={() => toggleModule(m.id)}
                />
                <span className={styles.pickerMain}>
                  <span
                    className="cs-card-title"
                    style={{ fontSize: "var(--cs-text-base)" }}
                  >
                    {m.label}
                  </span>
                  <span
                    className="cs-muted"
                    style={{
                      fontSize: "var(--cs-text-sm)",
                      lineHeight: "var(--cs-leading-snug)",
                    }}
                  >
                    {m.blurb}
                  </span>
                </span>
                <span className={`cs-num ${styles.pickerPrice}`}>
                  {formatUsd(m.amount)}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      {/* ===== Running-total rail ===== */}
      <aside className={styles.rail} aria-label="Your stack">
        <span className={styles.railTitle}>Your stack</span>

        {/* Debounced polite announcer — visually hidden; the visible total below is instant. */}
        <p
          className={styles.srOnly}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {announced}
        </p>

        {summary.moduleCount === 0 ? (
          <div className={styles.railEmpty}>
            <Icon name="inbox" size="lg" />
            <p>
              No modules selected yet. Pick modules on the left to see the
              running total — and any edition that would cover them for less.
            </p>
          </div>
        ) : (
          <>
            <ul className={styles.lines}>
              {summary.lineItems.map((m) => (
                <li key={m.id} className={styles.lineItem}>
                  <span className={styles.lineLabel}>{m.label}</span>
                  <span className={styles.linePrice}>
                    {formatUsd(m.amount)}
                  </span>
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => toggleModule(m.id)}
                    aria-label={`Remove ${m.label}`}
                  >
                    <Icon name="x" />
                  </button>
                </li>
              ))}
            </ul>

            <div className={styles.totalRow}>
              <span>Total</span>
              <span className={styles.totalNum}>
                {formatUsd(summary.total)}
              </span>
            </div>

            {upgrade && (
              <div className={styles.upgrade}>
                <p>
                  These modules add up to {formatUsd(summary.total)} — the{" "}
                  {upgrade.label} covers them for {formatUsd(upgrade.price)}.
                  Save {formatUsd(upgrade.saves)}.
                </p>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => addUpgradeToCart(upgrade.target)}
                >
                  Add {upgrade.label} instead
                </Button>
              </div>
            )}

            {cta}
          </>
        )}
      </aside>

      {/* ===== Fixed bottom bar (< 768px) — total + CTA when the rail can't stick ===== */}
      <div className={styles.mobileBar}>
        <span className={styles.mobileBarMeta}>
          <span
            className="cs-num"
            style={{
              fontSize: "var(--cs-text-xs)",
              color: "var(--cs-fg-muted)",
            }}
          >
            {summary.moduleCount} selected
          </span>
          <span className={`cs-num ${styles.totalNum}`}>
            {formatUsd(summary.total)}
          </span>
        </span>
        {cta}
      </div>
    </div>
  );
}
