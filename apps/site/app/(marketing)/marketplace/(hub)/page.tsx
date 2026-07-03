import {
  Button,
  Card,
  FeatureGrid,
  Icon,
  Reveal,
  Section,
  SkuMatrix,
  StatusChip,
} from "@/components";

import { AddToCartButton } from "@/components/add-to-cart-button";
import {
  BUNDLE_CATALOG_ITEM,
  editionCatalogItem,
  toCartItem,
} from "@/lib/catalog";
import type { CartItem } from "@/lib/cart";
import { breadcrumb, serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  bundleSavings,
  editionPrice,
  editionsSubtotal,
  EDITION_PRICES,
  formatPrice,
  formatUsd,
  priceById,
  SKU_COLUMNS,
  SKU_FEATURE_ROWS,
  SKU_PRICE_ROW,
} from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Marketplace — Editions",
  description:
    "Compare the four Caisson editions and the everything bundle. Each edition is a composition of the same audited base — one-time perpetual, own the source, no renewal gate.",
  path: "/marketplace",
});

// The Editions tab — the /marketplace hub root (ADR-0237 F1). Edition compare cards, the
// good/better/best ladder, and the SKU matrix. Modules/Build/Plans live on their sibling tabs.

function editionCartItem(slug: string): CartItem | undefined {
  const item = editionCatalogItem(slug);
  return item ? toCartItem(item) : undefined;
}

const bundleCartItem: CartItem | undefined = BUNDLE_CATALOG_ITEM
  ? toCartItem(BUNDLE_CATALOG_ITEM)
  : undefined;

// ---- Edition metadata (visual + copywriting; price comes from the pricing lib) ----
type EditionMeta = {
  readonly id: string;
  readonly accent: boolean;
  readonly includes: readonly string[];
};

const EDITION_META: readonly EditionMeta[] = [
  {
    id: "compliance",
    accent: true,
    includes: [
      "Fail-closed Postgres RLS (FORCE) + cross-tenant isolation tests",
      "S3 Object-Lock WORM evidence store",
      "Append-only SHA-256 audit chain — tamper breaks the link",
      "Per-tenant field encryption (HKDF-SHA256, per-tenant DEK)",
      "SOC 2 / HIPAA evidence-pack generator",
    ],
  },
  {
    id: "ai-kit",
    accent: false,
    includes: [
      "Provider-agnostic AI config + PG-atomic token metering",
      "Spend caps and per-tenant circuit breaker",
      "Eval harness that runs in CI, not in prod",
      "Prompt registry + input / output guardrails",
      "Agent-setup config bundles",
    ],
  },
  {
    id: "local-first",
    accent: false,
    includes: [
      "Compute seam — same code, on-device or hosted",
      "Privacy gate enforcing the no-egress boundary",
      "sqlite-vec ANN for on-device vector search",
      "Offline license + local store",
      "Commercial license — own the source, ship your product closed",
    ],
  },
  {
    id: "agentic-dev",
    accent: false,
    includes: [
      "Typed agent / skill / rule schema, validated at load",
      "Guarded lifecycle state machine — no edge to SHIP past a failed verify",
      "Hooks dispatcher for side-effect consolidation",
      "Capability → agent routing + local hybrid memory",
    ],
  },
] as const;

export default function MarketplaceEditionsPage() {
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Marketplace", path: "/marketplace" },
  ]);

  const editionNodes = EDITION_PRICES.filter((p) => p.amount !== null).map(
    (p) =>
      softwareApplication({
        name: `Caisson ${p.label}`,
        description: p.note,
        url: `${SITE_URL}/marketplace#${p.id}`,
        priceId: p.id,
      }),
  );

  const bundle = priceById("bundle");
  const bundleItem = bundleCartItem;
  const savings = bundleSavings();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbNode) }}
      />
      {editionNodes.map((node, i) => (
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
        lede="Every module stands alone. Compose your own stack à la carte, step up to a full edition, or take the whole library in one bundle."
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
                {editionPrice("module")}
              </p>
              <p
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                Take exactly the capability you need — field encryption, token
                metering, on-device search — onto your own base. 11 standalone
                modules, priced for what each one does.
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
                <span className="cs-card-title">Take an edition</span>
                <StatusChip label="Edition" />
              </div>
              <p
                className="cs-num"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-2xl)",
                  fontFamily: "var(--cs-font-mono)",
                }}
              >
                {editionPrice("local-first")}
              </p>
              <p
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                The whole capability, composed and audited — every module in
                that edition plus the shared base, one perpetual license. Own
                the source and ship it closed.
              </p>
              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <Button href="#editions" variant="ghost">
                  See the editions
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
                {bundle ? formatPrice(bundle) : "—"}
              </p>
              <p
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                All four editions plus the base —{" "}
                {formatUsd(editionsSubtotal())} of editions for{" "}
                {bundle ? formatPrice(bundle) : "—"}. One purchase, the whole
                library.
              </p>
              {bundleItem && (
                <div
                  style={{
                    marginTop: "var(--cs-space-6)",
                    display: "flex",
                    gap: "var(--cs-space-2)",
                    flexWrap: "wrap",
                  }}
                >
                  {/* One buy verb sitewide: Add to cart (ADR-0192). The bundle has no
                      detail page, so no secondary link — the cart is the one road. */}
                  <AddToCartButton item={bundleItem} variant="primary" />
                </div>
              )}
            </Card>
          </Reveal>
        </FeatureGrid>
      </Section>

      {/* ===== Edition cards — all four buyable ===== */}
      <Section
        id="editions"
        eyebrow="Editions"
        title="Four editions, one audited base."
        lede="Each edition is a composition of the same substrate — never a fork. Compliance is the front door; every edition is available today."
      >
        <FeatureGrid cols={2}>
          {EDITION_META.map((ed, i) => {
            const price = priceById(ed.id);
            const cartItem = editionCartItem(ed.id);
            return (
              <Reveal key={ed.id} delay={i * 60}>
                <div id={ed.id}>
                  <Card accent={ed.accent}>
                    {/* Header row: name + type chip (ADR-0237 F5). */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "var(--cs-space-3)",
                      }}
                    >
                      <span className="cs-card-title">
                        {price?.label ?? ed.id}
                      </span>
                      <StatusChip label="Edition" />
                    </div>

                    {/* Price — committed, no fabricated "was" compare (honesty floor, ADR-0130). */}
                    <p
                      className="cs-num"
                      style={{
                        marginTop: "var(--cs-space-4)",
                        fontSize: "var(--cs-text-2xl)",
                        fontFamily: "var(--cs-font-mono)",
                        letterSpacing: "var(--cs-tracking-tight)",
                      }}
                    >
                      {price ? formatPrice(price) : "—"}
                    </p>

                    <ul
                      style={{
                        margin: "var(--cs-space-5) 0 0",
                        padding: 0,
                        listStyle: "none",
                        display: "grid",
                        gap: "var(--cs-space-2)",
                      }}
                    >
                      {ed.includes.map((item) => (
                        <li
                          key={item}
                          className="cs-muted"
                          style={{
                            display: "flex",
                            gap: "var(--cs-space-2)",
                            fontSize: "var(--cs-text-sm)",
                            lineHeight: "var(--cs-leading-snug)",
                          }}
                        >
                          <Icon name="check" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    {/* One buy verb: Add to cart primary + a quiet Learn more (ADR-0192). */}
                    <div
                      style={{
                        marginTop: "var(--cs-space-6)",
                        display: "flex",
                        gap: "var(--cs-space-2)",
                        flexWrap: "wrap",
                      }}
                    >
                      {cartItem && (
                        <AddToCartButton item={cartItem} variant="primary" />
                      )}
                      <Button href={`/${ed.id}`} variant="ghost" size="sm">
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

      {/* ===== SKU matrix — editions × modules ===== */}
      <Reveal>
        <Section
          eyebrow="What&rsquo;s in each edition"
          title="Compose, don&rsquo;t fork."
          lede="The base substrate ships with every edition. Module rows show which controls land in which edition."
        >
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <SkuMatrix
              columns={[...SKU_COLUMNS]}
              rows={[...SKU_FEATURE_ROWS, SKU_PRICE_ROW]}
            />
          </div>
        </Section>
      </Reveal>
    </>
  );
}
