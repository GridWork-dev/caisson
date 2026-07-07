"use client";

import { useEffect, useState } from "react";

import { Button, Card, Icon, StatusChip } from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
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

import { PreviewDialog } from "./preview-dialog";
import { StackRail } from "./stack-rail";
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
 * The one-surface marketplace (ADR-0285 §1) — a single faceted grid over BOTH kinds. Merges the two
 * former catalogs (modules + bundles) into one card system: a type/category/price/media facet set +
 * text search, one card-viewer dialog (`PreviewDialog`) over a `{kind,id}` union, one compare tray
 * extended to both kinds, and the persistent cart-aware stack rail. The open card is reflected in a
 * `?view=<kind>:<slug>` param (History API, no scroll reset); the legacy `?m=`/`?b=` params still
 * open the right card on load (aliases). Client island — the page shell stays a Server Component.
 */
export function MarketplaceSurface() {
  const [type, setType] = useState<TypeFilter>("all");
  const [categories, setCategories] = useState<ReadonlySet<Category>>(
    new Set(),
  );
  const [bands, setBands] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState("");
  const [demoOnly, setDemoOnly] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<readonly string[]>([]);

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

  return (
    <>
      <div className={styles.surface}>
        {/* ===== Facets ===== */}
        <aside className={styles.facets} aria-label="Filter the catalog">
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Type</legend>
            {TYPE_OPTIONS.map((t) => (
              <label key={t.id} className={styles.option}>
                <input
                  type="radio"
                  name="type"
                  className={styles.checkbox}
                  checked={type === t.id}
                  onChange={() => setType(t.id)}
                />
                <span className={styles.optionLabel}>{t.label}</span>
                <span className={`cs-num ${styles.count}`}>
                  {typeCount(t.id)}
                </span>
              </label>
            ))}
          </fieldset>

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
                Has a diagram, demo, or video
              </span>
              <span className={`cs-num ${styles.count}`}>{mediaCount}</span>
            </label>
          </fieldset>
        </aside>

        {/* ===== Results ===== */}
        <div className={styles.surfaceMain}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bundles and modules…"
            aria-label="Search bundles and modules"
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

          <p className={styles.results} role="status" aria-live="polite">
            {countLabel}
          </p>

          {results.length === 0 ? (
            <div className={styles.empty}>
              <p>Nothing matches those filters.</p>
              <Button type="button" variant="ghost" onClick={clearAll}>
                Clear all filters
              </Button>
            </div>
          ) : (
            <div className="cs-grid cs-grid--2">
              {results.map((e) => (
                <SurfaceCard
                  key={e.viewId}
                  entry={e}
                  onOpen={openPreview}
                  compareChecked={compareIds.includes(e.viewId)}
                  compareDisabled={
                    compareIds.length >= COMPARE_MAX &&
                    !compareIds.includes(e.viewId)
                  }
                  onToggleCompare={toggleCompare}
                />
              ))}
            </div>
          )}
        </div>

        {/* ===== Stack rail (cart-aware) ===== */}
        <StackRail />
      </div>

      <PreviewDialog viewId={viewId} onClose={closePreview} />

      <CompareTray
        viewIds={compareIds}
        onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
        onClear={() => setCompareIds([])}
      />
    </>
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cs-space-2)",
          marginBottom: "var(--cs-space-3)",
        }}
      >
        <Icon name={mark} />
        <span
          className="cs-num"
          style={{
            fontSize: "var(--cs-text-xs)",
            color: "var(--cs-fg-muted)",
            textTransform: "uppercase",
            letterSpacing: "var(--cs-tracking-wide)",
          }}
        >
          {eyebrow}
        </span>
        {e.hasMedia && (
          <span className={styles.mediaTag}>
            <Icon name="gauge" />
            demo
          </span>
        )}
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
      <div style={{ marginTop: "var(--cs-space-5)", position: "relative" }}>
        {catalogItem ? (
          <AddToCartButton item={toCartItem(catalogItem)} />
        ) : null}
      </div>
    </Card>
  );
}
