"use client";

import { useEffect, useState } from "react";

import { Button, Card, Icon, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { moduleCatalogItem, toCartItem } from "@/lib/catalog";
import { moduleMark } from "@/lib/marks";
import { MODULE_PAGES } from "@/lib/module-pages";
import {
  type BundleId,
  formatUsd,
  MODULE_PRICES,
  PERSONA_BUNDLE_IDS,
  type ModulePrice,
} from "@/lib/pricing";

import { bundleLabel } from "./marketplace";
import styles from "./marketplace.module.css";
import { COMPARE_MAX, ModuleCompareTray } from "./module-compare";
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

// "Has media" = the pop-out shows a real demo: a produced depth-page video, or the ui-pro module's
// live @caisson/ui-pro component demo. Derived from the existing records — no new data field.
const MEDIA_SLUGS = new Set(
  MODULE_PAGES.filter((r) => r.video).map((r) => r.slug),
);
function moduleHasMedia(id: string): boolean {
  return id === "ui-pro" || MEDIA_SLUGS.has(id);
}

const TOTAL = MODULE_PRICES.length;

function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * Faceted à-la-carte catalog (ADR-0191, category facet W6.2). Left facet sidebar (category · price
 * band · has-media, AND across facets / OR within a facet) plus a text search, a result grid reusing
 * the module-card treatment, a live region announcing the result count, the purchase pop-out, and the
 * compare tray. Client island — the page shell stays a Server Component and mounts this leaf, passing
 * the set of slugs that have a depth page so a not-yet-built detail link never 404s (`detailSlugs`).
 * The open module is reflected in a `?m=<slug>` query param (History API, no scroll reset) and a
 * `?m=` present on load opens the pop-out.
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
  const [query, setQuery] = useState("");
  const [demoOnly, setDemoOnly] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<readonly string[]>([]);

  // Deep-link: open the pop-out on load from ?m=<slug> (read imperatively — no useSearchParams, so
  // no Suspense boundary), and mirror open/close into the URL without a scroll reset or navigation.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("m");
    if (m && MODULE_PRICES.some((p) => p.id === m)) setPreviewId(m);
  }, []);

  const syncPreviewParam = (id: string | null) => {
    const sp = new URLSearchParams(window.location.search);
    if (id) sp.set("m", id);
    else sp.delete("m");
    const qs = sp.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  };
  const openPreview = (id: string) => {
    setPreviewId(id);
    syncPreviewParam(id);
  };
  const closePreview = () => {
    setPreviewId(null);
    syncPreviewParam(null);
  };

  const toggleCompare = (id: string) =>
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= COMPARE_MAX
          ? prev
          : [...prev, id],
    );

  const q = query.trim().toLowerCase();
  const matchCategory = (m: ModulePrice) =>
    categories.size === 0 ||
    CATEGORIES.some((c) => categories.has(c) && inCategory(m, c));
  const matchBand = (m: ModulePrice) =>
    bands.size === 0 ||
    PRICE_BANDS.some((b) => bands.has(b.id) && b.test(m.amount));
  const matchQuery = (m: ModulePrice) =>
    q === "" || `${m.label} ${m.blurb}`.toLowerCase().includes(q);
  const matchDemo = (m: ModulePrice) => !demoOnly || moduleHasMedia(m.id);

  // AND across every facet; OR within each.
  const results = MODULE_PRICES.filter(
    (m) => matchCategory(m) && matchBand(m) && matchQuery(m) && matchDemo(m),
  );

  // Per-value counts are CONTEXTUAL: each option shows how many modules it would yield given the
  // OTHER active filters (never its own group), so a count never contradicts the result set.
  const categoryCount = (c: Category) =>
    MODULE_PRICES.filter(
      (m) => inCategory(m, c) && matchBand(m) && matchQuery(m) && matchDemo(m),
    ).length;
  const bandCount = (b: PriceBand) =>
    MODULE_PRICES.filter(
      (m) =>
        b.test(m.amount) && matchCategory(m) && matchQuery(m) && matchDemo(m),
    ).length;
  const demoCount = MODULE_PRICES.filter(
    (m) =>
      moduleHasMedia(m.id) && matchCategory(m) && matchBand(m) && matchQuery(m),
  ).length;

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
    ...(demoOnly
      ? [{ key: "demo", label: "Has demo", remove: () => setDemoOnly(false) }]
      : []),
  ];
  const clearAll = () => {
    setCategories(new Set());
    setBands(new Set());
    setDemoOnly(false);
    setQuery("");
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

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Media</legend>
            <label className={styles.option}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={demoOnly}
                onChange={() => setDemoOnly((v) => !v)}
              />
              <span className={styles.optionLabel}>
                Has a live demo or video
              </span>
              <span className={`cs-num ${styles.count}`}>{demoCount}</span>
            </label>
          </fieldset>
        </aside>

        {/* ===== Results ===== */}
        <div>
          {/* Text search over label + blurb. */}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules…"
            aria-label="Search modules"
            className={styles.search}
          />

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
                <ModuleCard
                  key={m.id}
                  module={m}
                  onOpen={openPreview}
                  compareChecked={compareIds.includes(m.id)}
                  compareDisabled={
                    compareIds.length >= COMPARE_MAX &&
                    !compareIds.includes(m.id)
                  }
                  onToggleCompare={toggleCompare}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ModulePreviewDialog
        moduleId={previewId}
        hasDetail={previewId ? hasDetail.has(previewId) : false}
        onClose={closePreview}
      />

      <ModuleCompareTray
        ids={compareIds}
        onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
        onClear={() => setCompareIds([])}
      />
    </>
  );
}

/** One catalog card — label + mono price + blurb + a buy CTA, plus a category tag and a compare
 *  toggle. Clicking anywhere on the card opens the module purchase pop-out; the card itself is a
 *  full-bleed overlay `<button>` (real button semantics) so keyboard/AT users get the same affordance
 *  as a mouse click. The footer (Add to cart) and the compare checkbox each stay `position: relative`
 *  so they win their own click over the overlay — the "stretched link with escape hatches" pattern,
 *  no nested interactive elements. moduleCatalogItem resolves for every MODULE_PRICES id (W7 wired all
 *  22), so the null arm below is type-narrowing only. */
function ModuleCard({
  module: m,
  onOpen,
  compareChecked,
  compareDisabled,
  onToggleCompare,
}: {
  module: ModulePrice;
  onOpen: (id: string) => void;
  compareChecked: boolean;
  compareDisabled: boolean;
  onToggleCompare: (id: string) => void;
}) {
  const catalogItem = moduleCatalogItem(m.id);
  const category = primaryCategory(m);
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
        {/* Compare toggle + type chip — position: relative to win the click over the overlay. */}
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--cs-space-2)",
            position: "relative",
          }}
        >
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--cs-space-1)",
              fontSize: "var(--cs-text-xs)",
              color: "var(--cs-fg-muted)",
              cursor: compareDisabled ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={compareChecked}
              disabled={compareDisabled}
              onChange={() => onToggleCompare(m.id)}
              aria-label={`Compare ${m.label}`}
            />
            Compare
          </label>
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
        ) : null}
      </div>
    </Card>
  );
}
