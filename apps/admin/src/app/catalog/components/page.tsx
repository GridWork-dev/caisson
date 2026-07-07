"use client";

// The live component catalog: every @caisson/ui (base kit), @caisson/ui-pro, and per-package `./ui`
// component, rendered from the shared registry — the one data source this page and the site's `/ui`
// gallery both read (the site repoint is a separate, later change). Absorbs the former hand-written
// gallery: what ships is what you see, now for the full 50-entry surface instead of just the base kit.
import { useMemo, useState } from "react";
import {
  CATALOG_ENTRIES,
  licenseTierSchema,
  listPackages,
  type CatalogEntry,
  type LicenseTier,
} from "@caisson/demo-registry";
import { CodeBlock, Select, StatusChip } from "@caisson/ui/components";

const TIER_LABEL: Record<LicenseTier, string> = {
  "apache-base": "Base kit",
  "ui-pro": "UI Pro",
  "per-package-ui": "Per-package",
};
const TIER_TONE: Record<LicenseTier, "muted" | "accent"> = {
  "apache-base": "muted",
  "ui-pro": "accent",
  "per-package-ui": "muted",
};
const TIERS = licenseTierSchema.options;
const PACKAGES = listPackages();

function EntryCard({ entry }: { entry: CatalogEntry }) {
  return (
    <div className="panel stack" style={{ gap: "var(--cs-space-4)" }}>
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{entry.name}</h3>
          <p
            className="muted mono"
            style={{
              fontSize: "var(--cs-text-sm)",
              margin: "var(--cs-space-1) 0 0",
            }}
          >
            {entry.package}
          </p>
        </div>
        <StatusChip
          tone={TIER_TONE[entry.tier]}
          label={TIER_LABEL[entry.tier]}
        />
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {entry.description}
      </p>
      <div
        className="row"
        style={{ gap: "var(--cs-space-2)", flexWrap: "wrap" }}
      >
        {entry.variants.map((v) => (
          <span key={v} className="badge">
            {v}
          </span>
        ))}
      </div>
      <div
        style={{
          borderTop: "1px solid var(--cs-border)",
          paddingTop: "var(--cs-space-4)",
        }}
      >
        {entry.render ? (
          entry.render()
        ) : entry.sampleProps ? (
          <CodeBlock code={JSON.stringify(entry.sampleProps, null, 2)} />
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            No live demo for this entry yet — see the description above.
          </p>
        )}
      </div>
    </div>
  );
}

export default function ComponentsCatalogPage() {
  const [tier, setTier] = useState<LicenseTier | "all">("all");
  const [pkg, setPkg] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG_ENTRIES.filter((e) => {
      if (tier !== "all" && e.tier !== tier) return false;
      if (pkg !== "all" && e.package !== pkg) return false;
      if (q === "") return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.variants.some((v) => v.toLowerCase().includes(q))
      );
    });
  }, [tier, pkg, query]);

  return (
    <div className="shell stack" style={{ gap: "var(--cs-space-12)" }}>
      <section>
        <p className="eyebrow">caisson · components</p>
        <h1 className="page-title" style={{ maxWidth: "24ch" }}>
          Every component, rendered live.
        </h1>
        <p className="lede">
          The base kit, UI Pro, and every per-package embeddable surface — one
          registry, {CATALOG_ENTRIES.length} entries. What ships is what you see
          here.
        </p>
      </section>

      <section
        className="panel row"
        style={{
          gap: "var(--cs-space-4)",
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <div className="stack" style={{ gap: "var(--cs-space-1)" }}>
          <label htmlFor="catalog-search" className="board-state mono">
            Search
          </label>
          <input
            id="catalog-search"
            type="search"
            placeholder="Filter by name, description, or variant…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: "16rem" }}
          />
        </div>
        <div className="stack" style={{ gap: "var(--cs-space-1)" }}>
          <label htmlFor="catalog-tier" className="board-state mono">
            Tier
          </label>
          <Select
            id="catalog-tier"
            value={tier}
            onChange={(e) => setTier(e.target.value as LicenseTier | "all")}
            options={[
              { value: "all", label: `All tiers (${CATALOG_ENTRIES.length})` },
              ...TIERS.map((t) => ({
                value: t,
                label: `${TIER_LABEL[t]} (${CATALOG_ENTRIES.filter((e) => e.tier === t).length})`,
              })),
            ]}
          />
        </div>
        <div className="stack" style={{ gap: "var(--cs-space-1)" }}>
          <label htmlFor="catalog-package" className="board-state mono">
            Package
          </label>
          <Select
            id="catalog-package"
            value={pkg}
            onChange={(e) => setPkg(e.target.value)}
            options={[
              { value: "all", label: "All packages" },
              ...PACKAGES.map((p) => ({ value: p, label: p })),
            ]}
          />
        </div>
        <p
          className="muted mono"
          style={{ fontSize: "var(--cs-text-sm)", margin: 0 }}
        >
          {filtered.length} of {CATALOG_ENTRIES.length} shown
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
          gap: "var(--cs-space-6)",
        }}
      >
        {filtered.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </section>
    </div>
  );
}
