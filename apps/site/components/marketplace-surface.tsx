"use client";

import { useEffect, useState } from "react";

import { Popover } from "@caisson-sh/ui-pro/components";

import { Button, Card, Checkbox, Icon, StatusChip } from "@/components";
import { isBundleId } from "@/lib/catalog";
import { BUNDLE_MARKS, moduleMark } from "@/lib/marks";
import {
  ALL_ENTRIES,
  CATEGORIES,
  categoryLabel,
  type Category,
  entryByViewId,
  inCategory,
  primaryCategory,
  type SurfaceEntry,
} from "@/lib/marketplace-surface";
import { modulePostureGroup } from "@/lib/stack-fit";
import type { TruthfulSignal } from "@/lib/trust-signals";

import { EntryLinks } from "./entry-links";
import { PreviewDialog } from "./preview-dialog";
import styles from "./marketplace.module.css";

type TypeFilter = "all" | "bundles" | "modules";
const TYPE_OPTIONS: readonly { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "bundles", label: "Module families" },
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
 * The one-surface demonstration gallery (ADR-0285 §1, ADR-0378 lock 3) — a single grid over BOTH
 * kinds: a sticky filter toolbar (segmented Type control + Category disclosure + media toggle +
 * search) over a Bundles band then a Modules band, and one card-viewer dialog (`PreviewDialog`)
 * over a `{kind,id}` union. Every card links to its docs and its live demo. The open card is
 * reflected in a `?view=<kind>:<slug>` param (History API, no scroll reset); the legacy `?m=`/`?b=`
 * params still open the right card on load (aliases). Client island — the shell stays a Server
 * Component, which resolves `docsHrefs` from the docs source at build time.
 */
export function MarketplaceSurface({
  signals,
  docsHrefs,
}: {
  signals: readonly TruthfulSignal[];
  /** viewId → docs page path, resolved server-side from the docs tree. */
  docsHrefs: Readonly<Record<string, string>>;
}) {
  const [type, setType] = useState<TypeFilter>("all");
  const [categories, setCategories] = useState<ReadonlySet<Category>>(
    new Set(),
  );
  const [query, setQuery] = useState("");
  const [demoOnly, setDemoOnly] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  // Which toolbar disclosure is open — Category on desktop, or the combined Filters panel on
  // mobile. One shared value so opening one closes the other (the nav-panels convention).
  const [openPanel, setOpenPanel] = useState<"category" | "filters" | null>(
    null,
  );

  // Deep-link on load (read imperatively — no useSearchParams, so no Suspense boundary):
  //   ?type=bundles|modules   pre-selects the type facet;
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

  const q = query.trim().toLowerCase();
  const matchType = (e: SurfaceEntry) =>
    type === "all" || e.kind === (type === "bundles" ? "bundle" : "module");
  const matchCategory = (e: SurfaceEntry) =>
    categories.size === 0 ||
    CATEGORIES.some((c) => categories.has(c) && inCategory(e, c));
  const matchQuery = (e: SurfaceEntry) =>
    q === "" || `${e.label} ${e.blurb}`.toLowerCase().includes(q);
  const matchMedia = (e: SurfaceEntry) => !demoOnly || e.hasMedia;

  const results = ALL_ENTRIES.filter(
    (e) => matchType(e) && matchCategory(e) && matchQuery(e) && matchMedia(e),
  );

  // Contextual per-value counts — each option shows how many entries it would yield given the OTHER
  // active facets (never its own group), so a count never contradicts the result set.
  const typeCount = (t: TypeFilter) =>
    ALL_ENTRIES.filter(
      (e) =>
        (t === "all" || e.kind === (t === "bundles" ? "bundle" : "module")) &&
        matchCategory(e) &&
        matchQuery(e) &&
        matchMedia(e),
    ).length;
  const categoryCount = (c: Category) =>
    ALL_ENTRIES.filter(
      (e) => inCategory(e, c) && matchType(e) && matchQuery(e) && matchMedia(e),
    ).length;
  const mediaCount = ALL_ENTRIES.filter(
    (e) => e.hasMedia && matchType(e) && matchCategory(e) && matchQuery(e),
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
    ...(demoOnly
      ? [{ key: "demo", label: "Has media", remove: () => setDemoOnly(false) }]
      : []),
  ];
  const clearAll = () => {
    setType("all");
    setCategories(new Set());
    setDemoOnly(false);
    setQuery("");
  };

  const countLabel =
    results.length === TOTAL
      ? `${TOTAL} module families and modules`
      : `Showing ${results.length} of ${TOTAL}`;

  const bundleResults = results.filter((e) => e.kind === "bundle");
  const moduleResults = results.filter((e) => e.kind === "module");

  const renderCard = (e: SurfaceEntry) => (
    <SurfaceCard
      key={e.viewId}
      entry={e}
      docsHref={docsHrefs[e.viewId]}
      onOpen={openPreview}
    />
  );

  // The filter controls, authored once and reused by the desktop toolbar and the mobile Filters
  // panel. Reusing one element object in two render slots is fine — both read the same component
  // state, so a toggle in either place updates the single source of truth.
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
      placeholder="Search module families and modules…"
      aria-label="Search module families and modules"
      className={styles.search}
    />
  );

  return (
    <>
      {/* ===== Sticky filter toolbar (ADR-0378 lock 3) ===== */}
      <div className={styles.toolbar}>
        {/* Desktop: segmented Type + Category disclosure + media toggle, inline. */}
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
          {mediaToggle}
        </div>

        {/* Mobile: one Filters disclosure holding all the controls. */}
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

      {/* ===== Results — Module families band, hairline divider, Modules band ===== */}
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
              <h3 className={styles.bandHead}>Module families</h3>
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

      <PreviewDialog
        viewId={viewId}
        onClose={closePreview}
        signals={signals}
        docsHrefs={docsHrefs}
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

/** One unified catalog card — bundle or module. Clicking anywhere opens the viewer (a full-bleed
 *  overlay button for real keyboard/AT semantics); the docs/demo links stay `position: relative`
 *  to win their own click over the overlay (the stretched-link pattern). */
function SurfaceCard({
  entry: e,
  docsHref,
  onOpen,
}: {
  entry: SurfaceEntry;
  docsHref: string | undefined;
  onOpen: (viewId: string) => void;
}) {
  const isBundle = e.kind === "bundle";
  const mark = isBundle
    ? isBundleId(e.id)
      ? BUNDLE_MARKS[e.id]
      : "bundle"
    : moduleMark(e.id);
  const eyebrow = isBundle
    ? "Module family"
    : categoryLabel(primaryCategory(e));
  // A module's honest DB posture (ADR-0285 §2).
  const posture = isBundle ? undefined : modulePostureGroup(e.id);

  return (
    <Card interactive style={{ position: "relative" }}>
      <button
        type="button"
        aria-label={`Preview ${e.label}`}
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
          {e.demoHref !== null && (
            <span className={styles.mediaTag}>
              <Icon name="gauge" />
              demo
            </span>
          )}
        </span>
        <span className={styles.cardMetaEnd}>
          <StatusChip label={isBundle ? "Module family" : "Module"} />
        </span>
      </div>
      <span className="cs-card-title">{e.label}</span>
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
        <EntryLinks label={e.label} docsHref={docsHref} demoHref={e.demoHref} />
      </div>
    </Card>
  );
}
