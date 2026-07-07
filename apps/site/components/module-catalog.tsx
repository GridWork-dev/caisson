"use client";

import { useState } from "react";

import { Button, Card, Icon, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { moduleCatalogItem, toCartItem } from "@/lib/catalog";
import { moduleMark } from "@/lib/marks";
import {
  type BundleId,
  formatUsd,
  MODULE_PRICES,
  PERSONA_BUNDLE_IDS,
  type ModulePrice,
} from "@/lib/pricing";

import { bundleLabel, bundlePagePath } from "./marketplace";
import styles from "./marketplace.module.css";
import { ModulePreviewDialog } from "./module-preview-dialog";

// Price bands DERIVED from module.amount — no new data field (ADR-0191: facets derive from the
// existing catalog). The full sellable catalog spans $49–$299 (ADR-0246 F1b, ADR-0258/0260 carve
// prices); these three bands partition it exactly ($49/$99 → under, $149 → mid, $199+ → up).
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

// The category facet (catalog-rework W6.2, supersedes the edition facet): the five persona/Provenance
// bundles a module can belong to, plus a "platform" bucket for the standalone commercial SKUs that no
// persona bundle grants (org-controls, billing-orchestration, ui-pro — Everything-only, ADR-0258).
// Categories DERIVE from the module's index-pinned `bundles[]`; no new data field.
const PLATFORM = "platform" as const;
type Category = BundleId | typeof PLATFORM;
const CATEGORIES: readonly Category[] = [...PERSONA_BUNDLE_IDS, PLATFORM];

function categoryLabel(cat: Category): string {
  return cat === PLATFORM ? "Platform" : bundleLabel(cat);
}

function inCategory(m: ModulePrice, cat: Category): boolean {
  return cat === PLATFORM
    ? m.bundles.length === 0
    : m.bundles.includes(cat as BundleId);
}

/** The module's primary category tag — its first bundle, or Platform when no bundle grants it. */
function primaryCategory(m: ModulePrice): Category {
  return m.bundles[0] ?? PLATFORM;
}

const TOTAL = MODULE_PRICES.length;

function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * Faceted à-la-carte catalog (ADR-0191, category facet W6.2). Left facet sidebar (category + price
 * band, AND across facets / OR within a facet), a result grid reusing the module-card treatment, and
 * a dedicated live region announcing the result count. Client island — the page shell stays a Server
 * Component and mounts this leaf, passing the set of slugs that have a depth page so a not-yet-built
 * detail link never 404s (`detailSlugs`).
 */
export function ModuleCatalog({
  detailSlugs = [],
}: {
  detailSlugs?: readonly string[];
}) {
  const hasDetail = new Set(detailSlugs);
  const [categories, setCategories] = useState<ReadonlySet<Category>>(
    new Set(),
  );
  const [bands, setBands] = useState<ReadonlySet<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);

  const matchCategory = (m: ModulePrice) =>
    categories.size === 0 ||
    CATEGORIES.some((c) => categories.has(c) && inCategory(m, c));
  const matchBand = (m: ModulePrice) =>
    bands.size === 0 ||
    PRICE_BANDS.some((b) => bands.has(b.id) && b.test(m.amount));

  // AND across the two facets; OR within each.
  const results = MODULE_PRICES.filter((m) => matchCategory(m) && matchBand(m));

  // Per-value counts are CONTEXTUAL: each option shows how many modules it would yield given the
  // OTHER facet's active filters (never its own group), so a count never contradicts the result set.
  const categoryCount = (c: Category) =>
    MODULE_PRICES.filter((m) => inCategory(m, c) && matchBand(m)).length;
  const bandCount = (b: PriceBand) =>
    MODULE_PRICES.filter((m) => b.test(m.amount) && matchCategory(m)).length;

  const chips = [
    ...[...categories].map((c) => ({
      key: `category:${c}`,
      label: categoryLabel(c),
      remove: () => setCategories((prev) => toggle(prev, c)),
    })),
    ...[...bands].map((id) => ({
      key: `band:${id}`,
      label: PRICE_BANDS.find((b) => b.id === id)?.label ?? id,
      remove: () => setBands((prev) => toggle(prev, id)),
    })),
  ];
  const clearAll = () => {
    setCategories(new Set());
    setBands(new Set());
  };

  const countLabel =
    results.length === TOTAL
      ? `${TOTAL} modules`
      : `Showing ${results.length} of ${TOTAL} modules`;

  return (
    <>
      <div className={styles.layout}>
        {/* ===== Facets ===== */}
        <aside className={styles.facets} aria-label="Filter modules">
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Category</legend>
            {CATEGORIES.map((c) => (
              <label key={c} className={styles.option}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={categories.has(c)}
                  onChange={() => setCategories((prev) => toggle(prev, c))}
                />
                <span className={styles.optionLabel}>{categoryLabel(c)}</span>
                <span className={`cs-num ${styles.count}`}>
                  {categoryCount(c)}
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
                <ModuleCard key={m.id} module={m} onOpen={setPreviewId} />
              ))}
            </div>
          )}
        </div>
      </div>
      <ModulePreviewDialog
        moduleId={previewId}
        hasDetail={previewId ? hasDetail.has(previewId) : false}
        onClose={() => setPreviewId(null)}
      />
    </>
  );
}

/** One catalog card — label + mono price + blurb + a buy CTA, plus a category tag. Clicking
 *  anywhere on the card opens the large module-preview dialog (`module-preview-dialog.tsx`); the
 *  card itself is a full-bleed overlay `<button>` (real button semantics, not a `div[role]`) so
 *  keyboard/AT users get the same affordance as a mouse click. The footer stays `position:
 *  relative` so its own controls (Add to cart / Learn more) win the click over the overlay — the
 *  "stretched link with an escape hatch" pattern, no nested interactive elements. A module that is
 *  Paddle-wired shows Add to cart; a not-yet-wired carve/standalone SKU (W7 wires it) shows a Learn
 *  more link to the bundle that grants it (never a fabricated "coming soon", ADR-0237 rider 2). */
function ModuleCard({
  module: m,
  onOpen,
}: {
  module: ModulePrice;
  onOpen: (id: string) => void;
}) {
  const catalogItem = moduleCatalogItem(m.id);
  const category = primaryCategory(m);
  const bundlePath =
    category === PLATFORM ? "/marketplace" : bundlePagePath(category);
  return (
    <Card interactive style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`Preview ${m.label} — ${formatUsd(m.amount)}`}
        onClick={() => onOpen(m.id)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          margin: 0,
          padding: 0,
          border: 0,
          background: "transparent",
          cursor: "pointer",
        }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cs-space-2)",
          marginBottom: "var(--cs-space-3)",
        }}
      >
        {/* The module's own bespoke mark (ADR-0237 F6) — the category stays a text tag. */}
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
          {categoryLabel(category)}
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
        <span className="cs-card-title">{m.label}</span>
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
      <div style={{ marginTop: "var(--cs-space-5)", position: "relative" }}>
        {catalogItem ? (
          <AddToCartButton item={toCartItem(catalogItem)} />
        ) : (
          <Button href={bundlePath} variant="ghost" size="sm">
            Learn more →
          </Button>
        )}
      </div>
    </Card>
  );
}
