"use client";

import { useEffect, useState } from "react";

import { Popover } from "@caisson/ui-pro/components";

import { Button, Card, Checkbox, Icon, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { useCart } from "@/components/cart-provider";
import { CompareTray, COMPARE_MAX } from "@/components/compare-tray";
import {
  bundleCatalogItem,
  moduleCatalogItem,
  toCartItem,
} from "@/lib/catalog";
import { BUNDLE_MARKS, moduleMark } from "@/lib/marks";
import {
  ALL_ENTRIES,
  CATEGORIES,
  categoryLabel,
  type Category,
  entryByViewId,
  inCategory,
  PRICE_BANDS,
  type PriceBand,
  primaryCategory,
  type SurfaceEntry,
} from "@/lib/marketplace-surface";
import { formatUsd, isBundleId } from "@/lib/pricing";
import { modulePostureGroup } from "@/lib/stack-fit";
import type { TruthfulSignal } from "@/lib/trust-signals";

import { PreviewDialog } from "./preview-dialog";
import styles from "./marketplace.module.css";

type TypeFilter = "all" | "bundles" | "modules";
const TYPE_OPTIONS: readonly { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bundles", label: "Bundles" },
  { id: "modules", label: "Modules" },
];

const TOTAL = ALL_ENTRIES.length;

function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/**
 * The one-surface marketplace (ADR-0285 §1, ADR-0378 lock 3) — a single grid over BOTH kinds. Merges
 * the two former catalogs (modules + bundles) into one card system: a sticky filter toolbar
 * (segmented Type control + Category/Price disclosure panels + media toggle + search) over a
 * Bundles band then a Modules band, one card-viewer dialog (`PreviewDialog`) over a `{kind,id}`
 * union, and one compare tray extended to both kinds. The 13rem facet rail and 21rem stack rail are
 * gone; the cart is the one drawer, with a slim summary strip once it is non-empty. The open card is
 * reflected in a `?view=<kind>:<slug>` param (History API, no scroll reset); the legacy `?m=`/`?b=`
 * params still open the right card on load (aliases). Client island — the shell stays a Server Component.
 */
export function MarketplaceSurface({
  signals,
}: {
  signals: readonly TruthfulSignal[];
}) {
  const [type, setType] = useState<TypeFilter>("all");
  const [categories, setCategories] = useState<ReadonlySet<Category>>(
    new Set(),
  );
  const [bands, setBands] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [demoOnly, setDemoOnly] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<readonly string[]>([]);
  // Which toolbar disclosure is open — Category / Price on desktop, or the combined Filters panel
  // on mobile. One shared value so opening one closes the others (the nav-panels convention).
  const [openPanel, setOpenPanel] = useState<
    "category" | "price" | "filters" | null
  >(null);

  // Deep-link on load (read imperatively — no useSearchParams, so no Suspense boundary):
  //   ?type=bundles|modules   pre-selects the type facet (e.g. a "Browse modules" CTA);
  //   ?view=<kind>:<slug>     opens that card's viewer, with the legacy ?m=/?b= aliases honored.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get("type");
    if (t === "bundles" || t === "modules") setType(t);

    const view = sp.get("view");
    if (view && entryByViewId(view)) {
      setViewId(view);
      return;
    }
    const m = sp.get("m");
    const b = sp.get("b");
    if (m && entryByViewId(`module:${m}`)) setViewId(`module:${m}`);
    else if (b && entryByViewId(`bundle:${b}`)) setViewId(`bundle:${b}`);
  }, []);

  const syncViewParam = (id: string | null) => {
    const sp = new URLSearchParams(window.location.search);
    // One param scheme now — drop the legacy aliases as we write the canonical one.
    sp.delete("m");
    sp.delete("b");
    if (id) sp.set("view", id);
    else sp.delete("view");
    const qs = sp.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  };
  const openPreview = (id: string) => {
    setViewId(id);
    syncViewParam(id);
  };
  const closePreview = () => {
    setViewId(null);
    syncViewParam(null);
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
  const matchType = (e: SurfaceEntry) =>
    type === "all" || e.kind === (type === "bundles" ? "bundle" : "module");
  const matchCategory = (e: SurfaceEntry) =>
    categories.size === 0 ||
    CATEGORIES.some((c) => categories.has(c) && inCategory(e, c));
  const matchBand = (e: SurfaceEntry) =>
    bands.size === 0 ||
    PRICE_BANDS.some((b) => bands.has(b.id) && b.test(e.amount));
  const matchQuery = (e: SurfaceEntry) =>
    q === "" || `${e.label} ${e.blurb}`.toLowerCase().includes(q);
  const matchMedia = (e: SurfaceEntry) => !demoOnly || e.hasMedia;

  const results = ALL_ENTRIES.filter(
    (e) =>
      matchType(e) &&
      matchCategory(e) &&
      matchBand(e) &&
      matchQuery(e) &&
      matchMedia(e),
  );

  // Contextual per-value counts — each option shows how many entries it would yield given the OTHER
  // active facets (never its own group), so a count never contradicts the result set.
  const typeCount = (t: TypeFilter) =>
    ALL_ENTRIES.filter(
      (e) =>
        (t === "all" || e.kind === (t === "bundles" ? "bundle" : "module")) &&
        matchCategory(e) &&
        matchBand(e) &&
        matchQuery(e) &&
        matchMedia(e),
    ).length;
  const categoryCount = (c: Category) =>
    ALL_ENTRIES.filter(
      (e) =>
        inCategory(e, c) &&
        matchType(e) &&
        matchBand(e) &&
        matchQuery(e) &&
        matchMedia(e),
    ).length;
  const bandCount = (band: PriceBand) =>
    ALL_ENTRIES.filter(
      (e) =>
        band.test(e.amount) &&
        matchType(e) &&
        matchCategory(e) &&
        matchQuery(e) &&
        matchMedia(e),
    ).length;
  const mediaCount = ALL_ENTRIES.filter(
    (e) =>
      e.hasMedia &&
      matchType(e) &&
      matchCategory(e) &&
      matchBand(e) &&
      matchQuery(e),
  ).length;

  const chips = [
    ...(type !== "all"
      ? [
          {
            key: `type:${type}`,
            label: TYPE_OPTIONS.find((t) => t.id === type)?.label ?? type,
            remove: () => setType("all"),
          },
        ]
      : []),
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
      ? [{ key: "demo", label: "Has media", remove: () => setDemoOnly(false) }]
      : []),
  ];
  const clearAll = () => {
    setType("all");
    setCategories(new Set());
    setBands(new Set());
    setDemoOnly(false);
    setQuery("");
  };

  const countLabel =
    results.length === TOTAL
      ? `${TOTAL} bundles and modules`
      : `Showing ${results.length} of ${TOTAL}`;

  const bundleResults = results.filter((e) => e.kind === "bundle");
  const moduleResults = results.filter((e) => e.kind === "module");

  const renderCard = (e: SurfaceEntry) => (
    <SurfaceCard
      key={e.viewId}
      entry={e}
      onOpen={openPreview}
      compareChecked={compareIds.includes(e.viewId)}
      compareDisabled={
        compareIds.length >= COMPARE_MAX && !compareIds.includes(e.viewId)
      }
      onToggleCompare={toggleCompare}
    />
  );

  // The four filter controls, authored once and reused by the desktop toolbar and the mobile
  // Filters panel. Reusing one element object in two render slots is fine — both read the same
  // component state, so a toggle in either place updates the single source of truth.
  const typeSegmented = (
    <div className={styles.segmented} role="group" aria-label="Type">
      {TYPE_OPTIONS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={styles.segment}
          aria-pressed={type === t.id}
          onClick={() => setType(t.id)}
        >
          {t.label}
          <span className={`cs-num ${styles.segmentCount}`}>
            {typeCount(t.id)}
          </span>
        </button>
      ))}
    </div>
  );

  const categoryFieldset = (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Category</legend>
      {CATEGORIES.map((c) => (
        <label key={c} className={styles.option}>
          <Checkbox
            checked={categories.has(c)}
            onChange={() => setCategories((prev) => toggle(prev, c))}
          />
          <span className={styles.optionLabel}>{categoryLabel(c)}</span>
          <span className={`cs-num ${styles.count}`}>{categoryCount(c)}</span>
        </label>
      ))}
    </fieldset>
  );

  const priceFieldset = (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Price</legend>
      {PRICE_BANDS.map((b) => (
        <label key={b.id} className={styles.option}>
          <Checkbox
            checked={bands.has(b.id)}
            onChange={() => setBands((prev) => toggle(prev, b.id))}
          />
          <span className={styles.optionLabel}>{b.label}</span>
          <span className={`cs-num ${styles.count}`}>{bandCount(b)}</span>
        </label>
      ))}
    </fieldset>
  );

  const mediaToggle = (
    <label className={styles.mediaToggle}>
      <Checkbox checked={demoOnly} onChange={() => setDemoOnly((v) => !v)} />
      <span>Has media</span>
      <span className={`cs-num ${styles.count}`}>{mediaCount}</span>
    </label>
  );

  const searchInput = (
    <input
      type="search"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search bundles and modules…"
      aria-label="Search bundles and modules"
      className={styles.search}
    />
  );

  return (
    <>
      {/* ===== Sticky filter toolbar (ADR-0378 lock 3) ===== */}
      <div className={styles.toolbar}>
        {/* Desktop: segmented Type + Category / Price disclosures + media toggle, inline. */}
        <div className={styles.desktopFilters}>
          {typeSegmented}
          <Popover
            trigger={
              <>
                {categories.size > 0
                  ? `Category (${categories.size})`
                  : "Category"}
                <Caret />
              </>
            }
            open={openPanel === "category"}
            onOpenChange={(o) => setOpenPanel(o ? "category" : null)}
          >
            {categoryFieldset}
          </Popover>
          <Popover
            trigger={
              <>
                {bands.size > 0 ? `Price (${bands.size})` : "Price"}
                <Caret />
              </>
            }
            open={openPanel === "price"}
            onOpenChange={(o) => setOpenPanel(o ? "price" : null)}
          >
            {priceFieldset}
          </Popover>
          {mediaToggle}
        </div>

        {/* Mobile: one Filters disclosure holding all four controls. */}
        <div className={styles.mobileFilters}>
          <Popover
            trigger={
              <>
                {chips.length > 0 ? `Filters (${chips.length})` : "Filters"}
                <Caret />
              </>
            }
            open={openPanel === "filters"}
            onOpenChange={(o) => setOpenPanel(o ? "filters" : null)}
          >
            <div className={styles.filtersStack}>
              {typeSegmented}
              {categoryFieldset}
              {priceFieldset}
              {mediaToggle}
            </div>
          </Popover>
        </div>

        {searchInput}
      </div>

      {/* ===== Chip row + aria-live count (kept) ===== */}
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
          <button type="button" className={styles.clearAll} onClick={clearAll}>
            Clear all
          </button>
        </div>
      )}

      <p className={styles.results} role="status" aria-live="polite">
        {countLabel}
      </p>

      {/* ===== Results — Bundles band, hairline divider, Modules band ===== */}
      {results.length === 0 ? (
        <div className={styles.empty}>
          <p>Nothing matches those filters.</p>
          <Button type="button" variant="ghost" onClick={clearAll}>
            Clear all filters
          </Button>
        </div>
      ) : (
        <>
          {bundleResults.length > 0 && (
            <section className={styles.band}>
              <h3 className={styles.bandHead}>Bundles</h3>
              <div className="cs-grid cs-grid--3">
                {bundleResults.map(renderCard)}
              </div>
            </section>
          )}
          {bundleResults.length > 0 && moduleResults.length > 0 && (
            <hr className={styles.divider} />
          )}
          {moduleResults.length > 0 && (
            <section className={styles.band}>
              <h3 className={styles.bandHead}>Modules</h3>
              <div className="cs-grid cs-grid--3">
                {moduleResults.map(renderCard)}
              </div>
            </section>
          )}
        </>
      )}

      <MarketplaceCartStrip />

      <PreviewDialog viewId={viewId} onClose={closePreview} signals={signals} />

      <CompareTray
        viewIds={compareIds}
        onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
        onClear={() => setCompareIds([])}
      />
    </>
  );
}

/** Small down-caret for the toolbar disclosure triggers (mirrors nav-panels' chevron). */
function Caret() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Slim sticky summary strip, /marketplace only (rendered inside this surface, which only mounts on
 *  /marketplace). Once the cart is non-empty it shows the line count + subtotal and a Review action
 *  that opens the one cart drawer — every open routes through the drawer's single view_cart
 *  chokepoint. Never renders on /cart or /dashboard/cart (this surface isn't on those routes). */
function MarketplaceCartStrip() {
  const { items, subtotal, openDrawer } = useCart();
  if (items.length === 0) return null;
  return (
    <div className={styles.cartStrip} role="region" aria-label="Cart summary">
      <span className={styles.cartStripMeta}>
        <span className="cs-num">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
        <span className={`cs-num ${styles.cartStripTotal}`}>
          {formatUsd(subtotal)}
        </span>
      </span>
      <Button type="button" variant="primary" onClick={openDrawer}>
        Review
      </Button>
    </div>
  );
}

/** One unified catalog card — bundle or module. Clicking anywhere opens the viewer (a full-bleed
 *  overlay button for real keyboard/AT semantics); the compare checkbox and the Add-to-cart footer
 *  stay `position: relative` to win their own click over the overlay (the stretched-link pattern). */
function SurfaceCard({
  entry: e,
  onOpen,
  compareChecked,
  compareDisabled,
  onToggleCompare,
}: {
  entry: SurfaceEntry;
  onOpen: (viewId: string) => void;
  compareChecked: boolean;
  compareDisabled: boolean;
  onToggleCompare: (viewId: string) => void;
}) {
  const isBundle = e.kind === "bundle";
  const mark = isBundle
    ? isBundleId(e.id)
      ? BUNDLE_MARKS[e.id]
      : "bundle"
    : moduleMark(e.id);
  const catalogItem = isBundle
    ? bundleCatalogItem(e.id)
    : moduleCatalogItem(e.id);
  const eyebrow = isBundle ? "Bundle" : categoryLabel(primaryCategory(e));
  // A module's honest DB posture, single-sourced from /stack-fit (ADR-0285 §2).
  const posture = isBundle ? undefined : modulePostureGroup(e.id);

  return (
    <Card interactive style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`Preview ${e.label} — ${formatUsd(e.amount)}`}
        onClick={() => onOpen(e.viewId)}
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
      <div className={styles.cardMeta}>
        <span className={styles.cardMetaLead}>
          <Icon name={mark} />
          <span className={`cs-num ${styles.cardEyebrow}`}>{eyebrow}</span>
          {e.hasMedia && (
            <span className={styles.mediaTag}>
              <Icon name="gauge" />
              demo
            </span>
          )}
        </span>
        <span className={styles.cardMetaEnd}>
          <label
            className={styles.cardCompare}
            style={{ cursor: compareDisabled ? "not-allowed" : "pointer" }}
          >
            <input
              type="checkbox"
              checked={compareChecked}
              disabled={compareDisabled}
              onChange={() => onToggleCompare(e.viewId)}
              aria-label={`Compare ${e.label}`}
            />
            Compare
          </label>
          <StatusChip label={isBundle ? "Bundle" : "Module"} />
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
        <span className="cs-card-title">{e.label}</span>
        <span
          className="cs-num"
          style={{
            fontFamily: "var(--cs-font-mono)",
            fontSize: "var(--cs-text-base)",
            whiteSpace: "nowrap",
          }}
        >
          {formatUsd(e.amount)}
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
        {e.blurb}
      </p>
      {posture ? (
        <div
          className={styles.mediaTag}
          style={{ marginTop: "var(--cs-space-3)" }}
        >
          <Icon name={posture.icon} />
          {posture.heading}
        </div>
      ) : null}
      <div style={{ marginTop: "var(--cs-space-5)", position: "relative" }}>
        {catalogItem ? (
          <AddToCartButton item={toCartItem(catalogItem)} />
        ) : null}
      </div>
    </Card>
  );
}
