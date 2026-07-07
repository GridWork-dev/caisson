import Link from "next/link";

import {
  Button,
  Card,
  Faq,
  FeatureGrid,
  Icon,
  Reveal,
  Section,
  StatusChip,
} from "@/components";

import { BundleCatalog } from "@/components/bundle-catalog";
import { bundlePagePath } from "@/components/marketplace";
import { BASE_CAPABILITIES, BASE_PACKAGES } from "@/lib/base-substrate";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  bundlePriceById,
  BUNDLE_PRICES,
  everythingSavings,
  formatPrice,
  formatUsd,
  MODULE_PRICES,
  moduleCatalogSubtotal,
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

// The Bundles tab — the /marketplace hub root (ADR-0237 F1, catalog-rework W6.2). The good/better/best
// ladder + FAQ + bundle Offer JSON-LD stay here (server-rendered SEO); the six interactive bundle
// cards — which open the purchase pop-out instead of navigating — live in the `BundleCatalog` client
// island below. Prices + membership all derive from `lib/pricing.ts` — never hand-keyed.

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

      {/* ===== Interactive bundle cards (client island) — open the purchase pop-out ===== */}
      <BundleCatalog />

      {/* ===== The open base — "batteries included" under the bundle prices (anxiety-relief beat,
          the SYNTHESIS §6 Tier-1 tile grid; ADR-0094 open-core made visible at purchase time) ===== */}
      <Reveal>
        <Section
          eyebrow="The open base"
          title="Every bundle sits on this. So can you, for free."
          lede="Before you weigh a bundle: the audited foundation under all of them is Apache-2.0, open source, and free to use on its own. Buy a bundle and it is a one-time perpetual license — source you own — but the base was always yours."
          band="surface"
        >
          <FeatureGrid cols={3}>
            {BASE_CAPABILITIES.map((c) => (
              <Card key={c.title}>
                <div className="cs-status">
                  <Icon name={c.icon} size="lg" />
                  {c.title}
                </div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {c.body}
                </p>
                <p
                  className="cs-footnote mono"
                  style={{
                    marginTop: "var(--cs-space-4)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {c.packages.map((p) => `@caisson/${p}`).join(" · ")}
                </p>
              </Card>
            ))}
          </FeatureGrid>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            {BASE_PACKAGES.length} packages under Apache-2.0.{" "}
            <Link href="/legal/license" style={{ color: "var(--cs-link)" }}>
              See the open / commercial split
            </Link>
            .
          </p>
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
