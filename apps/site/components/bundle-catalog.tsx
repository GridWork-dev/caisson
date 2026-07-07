"use client";

import { useEffect, useState } from "react";

import {
  Card,
  FeatureGrid,
  Icon,
  Reveal,
  Section,
  StatusChip,
  type IconName,
} from "@/components";
import {
  type BundleId,
  bundleModuleSubtotal,
  bundlePriceById,
  BUNDLE_PRICES,
  everythingSavings,
  formatPrice,
  formatUsd,
  MODULE_PRICES,
  moduleCatalogSubtotal,
  modulesByBundle,
} from "@/lib/pricing";

import { BundlePreviewDialog } from "./bundle-preview-dialog";

// One accent-free domain glyph per bundle (DESIGN.md §5 / ADR-0078 §5). Personas reuse their edition
// marks; Provenance takes the WORM/audit glyph; Everything the bundle glyph.
const BUNDLE_ICON: Record<BundleId, IconName> = {
  compliance: "edition-compliance",
  "ai-production": "edition-ai-kit",
  "local-first": "edition-local-ai",
  "agentic-dev": "edition-agent-dev",
  provenance: "audit-chain",
  everything: "bundle",
};

// One-line positioning per bundle beyond the price note — what the bundle is FOR (copywriting; the
// price + members come from the pricing lib).
const BUNDLE_TAGLINE: Record<BundleId, string> = {
  compliance: "For regulated SaaS that has to pass the audit.",
  "ai-production": "For AI features that have to survive production.",
  "local-first": "For data that can't leave the device.",
  "agentic-dev": "For teams shipping governed coding agents.",
  provenance: "For anyone who has to prove a record wasn't tampered with.",
  everything: "For the team that wants the whole library, one purchase.",
};

const VALID = new Set(BUNDLE_PRICES.map((b) => b.id as string));

/**
 * The interactive Bundles-tab surface (ADR-0237 F1): the six bundle cards, but clicking a card opens
 * the bundle purchase pop-out instead of navigating (the standalone pages stay live SEO spokes,
 * linked from inside the pop-out). The open bundle is reflected in a `?b=<slug>` query param via the
 * History API (no scroll reset, no full navigation), and a `?b=` present on load opens the pop-out.
 * Sections + headings still server-render (a client island SSRs its markup), so the SEO content is
 * unchanged; the page keeps the JSON-LD, the good/better/best ladder, and the FAQ.
 */
export function BundleCatalog() {
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Open on load from the URL — read imperatively (no useSearchParams → no Suspense boundary).
  useEffect(() => {
    const b = new URLSearchParams(window.location.search).get("b");
    if (b && VALID.has(b)) setPreviewId(b);
  }, []);

  const syncParam = (id: string | null) => {
    const sp = new URLSearchParams(window.location.search);
    if (id) sp.set("b", id);
    else sp.delete("b");
    const q = sp.toString();
    window.history.replaceState(
      null,
      "",
      q ? `${window.location.pathname}?${q}` : window.location.pathname,
    );
  };

  const open = (id: string) => {
    setPreviewId(id);
    syncParam(id);
  };
  const close = () => {
    setPreviewId(null);
    syncParam(null);
  };

  const everything = bundlePriceById("everything");
  const savings = everythingSavings();

  return (
    <>
      {/* ===== Persona + Provenance bundle cards ===== */}
      <Section
        id="bundles"
        eyebrow="Bundles"
        title="Six bundles, one audited base."
        lede="Each bundle is a composition of the same substrate — never a fork. Compliance is the front door; every bundle is priced below the sum of the modules it composes."
      >
        <FeatureGrid cols={2}>
          {BUNDLE_PRICES.filter((b) => b.id !== "everything").map((b, i) => {
            const members = modulesByBundle(b.id);
            const memberSubtotal = bundleModuleSubtotal(b.id);
            const saves =
              b.amount !== null ? Math.max(0, memberSubtotal - b.amount) : 0;
            return (
              <Reveal key={b.id} delay={i * 60}>
                <div id={b.id}>
                  <Card
                    accent={b.id === "compliance"}
                    interactive
                    style={{ position: "relative" }}
                  >
                    {/* Full-bleed overlay button — real button semantics so keyboard/AT users get
                        the same open-the-pop-out affordance as a mouse click. */}
                    <button
                      type="button"
                      aria-label={`Preview the ${b.label} bundle — ${formatPrice(b)}`}
                      onClick={() => open(b.id)}
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
                    {/* Header: glyph + name + type chip (ADR-0237 F5). */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "var(--cs-space-3)",
                      }}
                    >
                      <span
                        className="cs-card-title"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "var(--cs-space-2)",
                        }}
                      >
                        <Icon name={BUNDLE_ICON[b.id]} />
                        {b.label}
                      </span>
                      <StatusChip label="Bundle" />
                    </div>

                    <p
                      className="cs-muted"
                      style={{
                        marginTop: "var(--cs-space-2)",
                        fontSize: "var(--cs-text-sm)",
                      }}
                    >
                      {BUNDLE_TAGLINE[b.id]}
                    </p>

                    {/* Price — committed, no fabricated "was" compare (honesty floor, ADR-0130). */}
                    <div
                      style={{
                        marginTop: "var(--cs-space-4)",
                        display: "flex",
                        alignItems: "baseline",
                        gap: "var(--cs-space-3)",
                        flexWrap: "wrap",
                      }}
                    >
                      <p
                        className="cs-num"
                        style={{
                          fontSize: "var(--cs-text-2xl)",
                          fontFamily: "var(--cs-font-mono)",
                          letterSpacing: "var(--cs-tracking-tight)",
                        }}
                      >
                        {formatPrice(b)}
                      </p>
                      {saves > 0 && (
                        <StatusChip
                          tone="accent"
                          label={`Save ${formatUsd(saves)} vs à la carte`}
                        />
                      )}
                    </div>

                    <ul
                      style={{
                        margin: "var(--cs-space-5) 0 0",
                        padding: 0,
                        listStyle: "none",
                        display: "grid",
                        gap: "var(--cs-space-2)",
                      }}
                    >
                      {members.map((m) => (
                        <li
                          key={m.id}
                          className="cs-muted"
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: "var(--cs-space-2)",
                            fontSize: "var(--cs-text-sm)",
                            lineHeight: "var(--cs-leading-snug)",
                          }}
                        >
                          <Icon name="check" />
                          <span style={{ flex: 1 }}>{m.label}</span>
                          <span
                            className="cs-num"
                            style={{
                              fontSize: "var(--cs-text-xs)",
                              color: "var(--cs-fg-muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatUsd(m.amount)}
                          </span>
                        </li>
                      ))}
                      <li
                        className="cs-muted"
                        style={{
                          display: "flex",
                          gap: "var(--cs-space-2)",
                          fontSize: "var(--cs-text-sm)",
                          lineHeight: "var(--cs-leading-snug)",
                        }}
                      >
                        <Icon name="check" />
                        <span>The Apache-2.0 base substrate</span>
                      </li>
                    </ul>

                    <div
                      style={{
                        marginTop: "var(--cs-space-6)",
                        color: "var(--cs-link)",
                        fontSize: "var(--cs-text-sm)",
                        fontWeight: "var(--cs-weight-medium)",
                      }}
                    >
                      View details &amp; buy →
                    </div>
                  </Card>
                </div>
              </Reveal>
            );
          })}
        </FeatureGrid>
      </Section>

      {/* ===== Everything bundle — the whole catalog ===== */}
      <Reveal>
        <Section
          id="everything"
          eyebrow="Everything"
          title="The whole catalog, one purchase."
          lede="The Everything bundle is exactly what it says: every commercial bundle and every à-la-carte module — the full sellable catalog, composed on the same audited base."
          band="tint"
        >
          <Card
            accent
            interactive
            className="cs-elevate-md"
            style={{ position: "relative" }}
          >
            <button
              type="button"
              aria-label="Preview the Everything bundle"
              onClick={() => open("everything")}
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
                flexWrap: "wrap",
                alignItems: "baseline",
                gap: "var(--cs-space-3)",
              }}
            >
              <span
                className="cs-num"
                style={{
                  fontSize: "var(--cs-text-3xl)",
                  fontWeight: "var(--cs-weight-semibold)",
                  letterSpacing: "var(--cs-tracking-tight)",
                }}
              >
                {everything ? formatPrice(everything) : "—"}
              </span>
              <span className="cs-tag">One-time · own the source</span>
              {savings > 0 && (
                <StatusChip
                  tone="accent"
                  label={`Save ${formatUsd(savings)} vs à la carte`}
                  dot
                />
              )}
            </div>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "60ch" }}
            >
              Every one of the {MODULE_PRICES.length} sellable modules à la
              carte totals {formatUsd(moduleCatalogSubtotal())}. The Everything
              bundle is the whole commercial catalog — including the platform
              modules no persona bundle carries (org controls, billing
              orchestration, UI Pro) — for{" "}
              {everything ? formatPrice(everything) : "—"}. Only the private
              brand layer is excluded. One purchase, the whole library.
            </p>
            <div
              style={{
                marginTop: "var(--cs-space-6)",
                color: "var(--cs-link)",
                fontSize: "var(--cs-text-sm)",
                fontWeight: "var(--cs-weight-medium)",
              }}
            >
              See what&rsquo;s inside &amp; buy →
            </div>
          </Card>
        </Section>
      </Reveal>

      <BundlePreviewDialog bundleId={previewId} onClose={close} />
    </>
  );
}
