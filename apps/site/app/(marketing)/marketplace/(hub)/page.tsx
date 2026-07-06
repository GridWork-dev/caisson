import {
  Button,
  Card,
  Faq,
  FeatureGrid,
  Icon,
  Reveal,
  Section,
  StatusChip,
  type IconName,
} from "@/components";

import { bundlePagePath } from "@/components/marketplace";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
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

export const metadata = buildMetadata({
  title: "Marketplace — Bundles",
  description: `Buy a Caisson module, a bundle, or the whole catalog — ${MODULE_PRICES.length} modules composed into six bundles, one-time perpetual pricing. Compose your own stack or take a bundle; own the source, no forced renewal.`,
  path: "/marketplace",
});

// The hub FAQ — real migration/purchase questions (ADR-0080 §6, no schema-bait), rendered
// visibly below the cards and mirrored into FAQPage JSON-LD.
const HUB_FAQ = [
  {
    question: "What happened to /pricing, /modules, and /build?",
    answer:
      "They're tabs here now — Bundles, Modules, and Build, plus a Plans tab for subscriptions and enterprise procurement. Old links redirect automatically.",
  },
  {
    question: "Can I buy one module without the bundle around it?",
    answer: `Yes. Each of the ${MODULE_PRICES.length} modules is a standalone one-time purchase — pick what composes onto your base, no bundle required.`,
  },
] as const;

// The Bundles tab — the /marketplace hub root (ADR-0237 F1, catalog-rework W6.2). Six bundle cards
// (the five persona/Provenance bundles + the whole-catalog Everything), the good/better/best ladder,
// and the à-la-carte pointer. Modules/Build/Plans live on their sibling tabs. Prices + membership all
// derive from `lib/pricing.ts` (ADR-0257 vocabulary · ADR-0258/0260 numbers) — never hand-keyed.

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

export default function MarketplaceBundlesPage() {
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
  ]);

  // One SoftwareApplication node per bundle, carrying its committed Offer (ADR-0082, InStock).
  const bundleNodes = BUNDLE_PRICES.map((b) =>
    softwareApplication({
      name: `Caisson ${b.label}`,
      description: b.note,
      url: `${SITE_URL}${bundlePagePath(b.id)}`,
      price: b,
    }),
  );

  const everything = bundlePriceById("everything");
  const savings = everythingSavings();
  // The cheapest persona/Provenance bundle — the "from $X" floor of the bundle ladder.
  const personaFloor = Math.min(
    ...BUNDLE_PRICES.filter((b) => b.id !== "everything").map(
      (b) => b.amount ?? Infinity,
    ),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbNode) }}
      />
      {bundleNodes.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}

      {/* ===== How to buy — good/better/best ladder ===== */}
      <Section
        eyebrow="Three ways to buy"
        title="Start small, or take it all."
        lede="Every module stands alone. Compose your own stack à la carte, step up to a bundle for a whole domain, or take the entire library in the Everything bundle."
      >
        <FeatureGrid cols={3}>
          <Reveal>
            <Card>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "var(--cs-space-3)",
                }}
              >
                <span className="cs-card-title">Pick a module</span>
                <StatusChip label="Module" />
              </div>
              <p
                className="cs-num"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-2xl)",
                  fontFamily: "var(--cs-font-mono)",
                }}
              >
                from{" "}
                {formatUsd(Math.min(...MODULE_PRICES.map((m) => m.amount)))}
              </p>
              <p
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                Take exactly the capability you need — field encryption, token
                metering, on-device search — onto your own base.{" "}
                {MODULE_PRICES.length} standalone modules, priced for what each
                one does.
              </p>
              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <Button href="/marketplace/modules" variant="ghost">
                  Browse modules
                </Button>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={80}>
            <Card>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "var(--cs-space-3)",
                }}
              >
                <span className="cs-card-title">Take a bundle</span>
                <StatusChip label="Bundle" />
              </div>
              <p
                className="cs-num"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-2xl)",
                  fontFamily: "var(--cs-font-mono)",
                }}
              >
                from {formatUsd(personaFloor)}
              </p>
              <p
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                A whole domain, composed and audited — every module in that
                bundle plus the shared base, one perpetual license, below the
                sum of its parts. Own the source and ship it closed.
              </p>
              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <Button href="#bundles" variant="ghost">
                  See the bundles
                </Button>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={160}>
            <Card accent>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: "var(--cs-space-3)",
                }}
              >
                <span className="cs-card-title">Everything bundle</span>
                {savings > 0 && (
                  <StatusChip
                    tone="accent"
                    label={`Save ${formatUsd(savings)}`}
                    dot
                  />
                )}
              </div>
              <p
                className="cs-num"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-2xl)",
                  fontFamily: "var(--cs-font-mono)",
                }}
              >
                {everything ? formatPrice(everything) : "—"}
              </p>
              <p
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                The whole commercial catalog — every bundle and every à-la-carte
                module — for {everything ? formatPrice(everything) : "—"} vs{" "}
                {formatUsd(moduleCatalogSubtotal())} à la carte. One purchase,
                the whole library.
              </p>
              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <Button href="#everything" variant="ghost">
                  See what&rsquo;s inside
                </Button>
              </div>
            </Card>
          </Reveal>
        </FeatureGrid>
      </Section>

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
                  <Card accent={b.id === "compliance"}>
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
                        display: "flex",
                        gap: "var(--cs-space-2)",
                        flexWrap: "wrap",
                      }}
                    >
                      <Button href={bundlePagePath(b.id)} variant="ghost">
                        Learn more →
                      </Button>
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
          <Card accent className="cs-elevate-md">
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
            <div className="cs-cta-row">
              <Button href="/marketplace/modules" variant="primary">
                Browse the full catalog
              </Button>
            </div>
          </Card>
        </Section>
      </Reveal>

      {/* ===== FAQ — the redirect + à-la-carte explainers ===== */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqPage(HUB_FAQ)) }}
      />
      <Section eyebrow="FAQ" title="Buying, briefly.">
        <Faq items={HUB_FAQ} defaultOpenFirst />
      </Section>
    </>
  );
}
