"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, Card, Icon, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { moduleCatalogItem, toCartItem } from "@/lib/catalog";
import { moduleMark } from "@/lib/marks";
import {
  EDITION_IDS,
  formatUsd,
  MODULE_PRICES,
  type EditionId,
  type ModulePrice,
} from "@/lib/pricing";

import { editionLabel } from "./marketplace";
import styles from "./marketplace.module.css";

// Price bands DERIVED from module.amount — no new data field (ADR-0191: facets derive from the
// existing catalog). The 11-module catalog spans $49–$199 (ADR-0238 dropped the $299 rows);
// these three bands partition it exactly ($49/$99 → under, $149 → mid, $199 → up).
interface PriceBand {
  id: string;
  label: string;
  test: (amount: number) => boolean;
}

const PRICE_BANDS: readonly PriceBand[] = [
  { id: "under-100", label: "Under $100", test: (a) => a < 100 },
  { id: "100-149", label: "$100–149", test: (a) => a >= 100 && a <= 149 },
  { id: "150-up", label: "$150 and up", test: (a) => a >= 150 },
];

const TOTAL = MODULE_PRICES.length;

function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * Faceted à-la-carte catalog (ADR-0191). Left facet sidebar (edition + price band, AND across
 * facets / OR within a facet), a result grid reusing the /pricing module-card treatment, and a
 * dedicated live region announcing the result count. Client island — the page shell stays a Server
 * Component and mounts this leaf.
 */
export function ModuleCatalog() {
  const [editions, setEditions] = useState<ReadonlySet<EditionId>>(new Set());
  const [bands, setBands] = useState<ReadonlySet<string>>(new Set());

  const matchEdition = (m: ModulePrice) =>
    editions.size === 0 || editions.has(m.edition);
  const matchBand = (m: ModulePrice) =>
    bands.size === 0 ||
    PRICE_BANDS.some((b) => bands.has(b.id) && b.test(m.amount));

  // AND across the two facets; OR within each (the .has() checks above).
  const results = MODULE_PRICES.filter((m) => matchEdition(m) && matchBand(m));

  // Per-value counts are CONTEXTUAL: each option shows how many modules it would yield given the
  // OTHER facet's active filters (never its own group), so a count never contradicts the result set.
  const editionCount = (e: EditionId) =>
    MODULE_PRICES.filter((m) => m.edition === e && matchBand(m)).length;
  const bandCount = (b: PriceBand) =>
    MODULE_PRICES.filter((m) => b.test(m.amount) && matchEdition(m)).length;

  const chips = [
    ...[...editions].map((e) => ({
      key: `edition:${e}`,
      label: editionLabel(e),
      remove: () => setEditions((prev) => toggle(prev, e)),
    })),
    ...[...bands].map((id) => ({
      key: `band:${id}`,
      label: PRICE_BANDS.find((b) => b.id === id)?.label ?? id,
      remove: () => setBands((prev) => toggle(prev, id)),
    })),
  ];
  const clearAll = () => {
    setEditions(new Set());
    setBands(new Set());
  };

  const countLabel =
    results.length === TOTAL
      ? `${TOTAL} modules`
      : `Showing ${results.length} of ${TOTAL} modules`;

  return (
    <div className={styles.layout}>
      {/* ===== Facets ===== */}
      <aside className={styles.facets} aria-label="Filter modules">
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Edition</legend>
          {EDITION_IDS.map((e) => (
            <label key={e} className={styles.option}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={editions.has(e)}
                onChange={() => setEditions((prev) => toggle(prev, e))}
              />
              <span className={styles.optionLabel}>{editionLabel(e)}</span>
              <span className={`cs-num ${styles.count}`}>
                {editionCount(e)}
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Price</legend>
          {PRICE_BANDS.map((b) => (
            <label key={b.id} className={styles.option}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={bands.has(b.id)}
                onChange={() => setBands((prev) => toggle(prev, b.id))}
              />
              <span className={styles.optionLabel}>{b.label}</span>
              <span className={`cs-num ${styles.count}`}>{bandCount(b)}</span>
            </label>
          ))}
        </fieldset>
      </aside>

      {/* ===== Results ===== */}
      <div>
        {chips.length > 0 && (
          <div className={styles.chips}>
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                className={styles.chip}
                onClick={c.remove}
                aria-label={`Remove ${c.label} filter`}
              >
                {c.label}
                <Icon name="x" />
              </button>
            ))}
            <button
              type="button"
              className={styles.clearAll}
              onClick={clearAll}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Result count — its OWN polite live region (ADR-0194). */}
        <p className={styles.results} role="status" aria-live="polite">
          {countLabel}
        </p>

        {results.length === 0 ? (
          <div className={styles.empty}>
            <p>No modules match those filters.</p>
            <Button type="button" variant="ghost" onClick={clearAll}>
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="cs-grid cs-grid--3">
            {results.map((m) => (
              <ModuleCard key={m.id} module={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** One catalog card — label + mono price + blurb + AddToCartButton, plus an edition tag (the flat
 *  filtered grid drops the per-edition group header). */
function ModuleCard({ module: m }: { module: ModulePrice }) {
  const catalogItem = moduleCatalogItem(m.id);
  if (catalogItem === undefined) {
    throw new Error(`module-catalog: no catalog entry for module "${m.id}"`);
  }
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cs-space-2)",
          marginBottom: "var(--cs-space-3)",
        }}
      >
        {/* The module's own bespoke mark (ADR-0237 F6) — the edition stays a text tag. */}
        <Icon name={moduleMark(m.id)} />
        <span
          className="cs-num"
          style={{
            fontSize: "var(--cs-text-xs)",
            color: "var(--cs-fg-muted)",
            textTransform: "uppercase",
            letterSpacing: "var(--cs-tracking-wide)",
          }}
        >
          {editionLabel(m.edition)}
        </span>
        {/* Type chip (ADR-0237 F5) — every price surface names its kind. */}
        <span style={{ marginLeft: "auto" }}>
          <StatusChip label="Module" />
        </span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "var(--cs-space-3)",
        }}
      >
        <Link
          href={`/marketplace/modules/${m.id}`}
          className="cs-card-title"
          style={{ textDecoration: "none" }}
        >
          {m.label}
        </Link>
        <span
          className="cs-num"
          style={{
            fontFamily: "var(--cs-font-mono)",
            fontSize: "var(--cs-text-base)",
            whiteSpace: "nowrap",
          }}
        >
          {formatUsd(m.amount)}
        </span>
      </div>
      <p
        className="cs-muted"
        style={{
          marginTop: "var(--cs-space-3)",
          fontSize: "var(--cs-text-sm)",
          lineHeight: "var(--cs-leading-snug)",
        }}
      >
        {m.blurb}
      </p>
      <div style={{ marginTop: "var(--cs-space-5)" }}>
        <AddToCartButton item={toCartItem(catalogItem)} />
      </div>
    </Card>
  );
}
