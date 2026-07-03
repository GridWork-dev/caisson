import {
  Button,
  Card,
  FeatureGrid,
  Hero,
  Icon,
  Reveal,
  Section,
  SkuMatrix,
  StatusChip,
  Terminal,
} from "@/components";
import Link from "next/link";

import { AddToCartButton } from "@/components/add-to-cart-button";
import { CheckoutCta } from "@/components/checkout-cta";
import { UpdatesForm } from "@/components/waitlist-form";
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
  PLAN_PRICES,
  priceById,
  SKU_COLUMNS,
  SKU_FEATURE_ROWS,
  SKU_PRICE_ROW,
} from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Pricing",
  description:
    "Caisson pricing: buy a module à la carte, a whole edition, or the everything bundle — one-time perpetual, plus two subscription plans. Own the source, no renewal gate.",
  path: "/pricing",
});

// ---- Local helpers ----
// Build the persisted CartItem for an edition slug, or undefined if the slug has no catalog row —
// server-safe (the catalog is a pure data lookup).
function editionCartItem(slug: string): CartItem | undefined {
  const item = editionCatalogItem(slug);
  return item ? toCartItem(item) : undefined;
}

// The persisted CartItem for the everything bundle, or undefined if the bundle row is dropped.
const bundleCartItem: CartItem | undefined = BUNDLE_CATALOG_ITEM
  ? toCartItem(BUNDLE_CATALOG_ITEM)
  : undefined;

// ---- Edition metadata (visual + copywriting; price comes from the pricing lib) ----
// Every edition is a real, buyable product (the storefront shows the full catalog as-if-built).
// The roadmap framing that used to gate Agentic-Dev is retired: no `checkout: false`, no roadmap
// tag, no "coming soon".
type EditionMeta = {
  readonly id: string;
  readonly tag: string;
  readonly accent: boolean;
  readonly cta: string;
  readonly includes: readonly string[];
};

const EDITION_META: readonly EditionMeta[] = [
  {
    id: "compliance",
    tag: "Hero edition",
    accent: true,
    cta: "Get Compliance",
    includes: [
      "Fail-closed Postgres RLS (FORCE) + cross-tenant isolation tests",
      "S3 Object-Lock WORM evidence store, COMPLIANCE mode",
      "Append-only SHA-256 audit chain — tamper breaks the link",
      "Per-tenant field encryption (HKDF-SHA256, per-tenant DEK)",
      "SOC 2 / HIPAA evidence-pack generator",
    ],
  },
  {
    id: "ai-kit",
    tag: "Edition #2",
    accent: false,
    cta: "Get AI Kit",
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
    tag: "Edition #3",
    accent: false,
    cta: "Get Local-first AI",
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
    tag: "Edition #4",
    accent: false,
    cta: "Get Agentic-Dev",
    includes: [
      "Typed agent / skill / rule schema, validated at load",
      "Guarded lifecycle state machine — no edge to SHIP past a failed verify",
      "Hooks dispatcher for side-effect consolidation",
      "Capability → agent routing + local hybrid memory",
    ],
  },
] as const;

// ---- Subscription metadata (rich detail; price comes from PLAN_PRICES) ----
type SubMeta = {
  readonly id: string;
  readonly audience: string;
  readonly includes: readonly string[];
};

const SUB_META: readonly SubMeta[] = [
  {
    id: "compliance-updates",
    audience: "For the team that has to pass the audit again next year.",
    includes: [
      "Auto-updating control mappings — SOC 2, HIPAA, EU AI Act, DORA, NIS2",
      "Evidence-pack regeneration on every framework revision",
      "New-framework slots as regulations land",
      "Control-drift alerts when a mapping goes stale",
      "Compliance support SLA",
    ],
  },
  {
    id: "developer",
    audience: "For the team building on the base every week.",
    includes: [
      "Monthly codegen + AI-feature credit allotment",
      "Framework and module updates as they ship",
      "Private-registry pulls, entitlement-scoped",
      "New-edition access on release",
      "Priority developer support",
    ],
  },
] as const;

// ---- SKU matrix ----
export default function PricingPage() {
  // JSON-LD — breadcrumb + one SoftwareApplication per edition
  const breadcrumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Pricing", path: "/pricing" },
  ]);

  const editionNodes = EDITION_PRICES.filter((p) => p.amount !== null).map(
    (p) =>
      softwareApplication({
        name: `Caisson ${p.label}`,
        description: p.note,
        url: `${SITE_URL}/pricing#${p.id}`,
        priceId: p.id,
      }),
  );

  const enterprise = PLAN_PRICES.find((p) => p.id === "enterprise");
  const bundle = priceById("bundle");
  const bundleItem = bundleCartItem;
  const savings = bundleSavings();

  return (
    <>
      {/* JSON-LD */}
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

      {/* ===== Hero ===== */}
      <Hero
        eyebrow="Pricing"
        title="Buy a module, an edition, or everything."
        lede="Value-based, à la carte: take a single module for what it does, a full edition when you want the whole capability, or the everything bundle at a discount. Own the source — no renewal gate."
        ctas={
          <>
            <Button href="#editions" variant="primary">
              See the editions
            </Button>
            <Button href="#modules" variant="ghost">
              Browse modules
            </Button>
          </>
        }
        artifact={
          <Terminal
            label="editions"
            status={<StatusChip label="available" tone="success" dot />}
          >
            {"edition."}
            <span className="cs-tok-accent">compliance</span>
            {`    ${editionPrice("compliance")}     perpetual\nedition.`}
            <span className="cs-tok-accent">ai-kit</span>
            {`        ${editionPrice("ai-kit")}     perpetual\nedition.`}
            <span className="cs-tok-accent">local-first</span>
            {`   ${editionPrice("local-first")}     perpetual\nedition.`}
            <span className="cs-tok-accent">agentic-dev</span>
            {`   ${editionPrice("agentic-dev")}     perpetual\n`}
            <span className="cs-tok-success">bundle.everything</span>
            {`     ${bundle ? formatPrice(bundle) : "—"}   all four + base`}
          </Terminal>
        }
      />

      {/* ===== How to buy — good/better/best ladder ===== */}
      <Section
        eyebrow="Three ways to buy"
        title="Start small, or take it all."
        lede="Every module stands alone. Compose your own stack à la carte, step up to a full edition, or take the whole library in one bundle."
      >
        <FeatureGrid cols={3}>
          {/* Good — a single module */}
          <Reveal>
            <Card>
              <span className="cs-card-title">Pick a module</span>
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
                <Button href="#modules" variant="ghost">
                  Browse modules
                </Button>
              </div>
            </Card>
          </Reveal>

          {/* Better — a full edition */}
          <Reveal delay={80}>
            <Card>
              <span className="cs-card-title">Take an edition</span>
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

          {/* Best — the everything bundle */}
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
                    {/* Header row: name + tag */}
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
                      <span
                        style={{
                          fontFamily: "var(--cs-font-mono)",
                          fontSize: "var(--cs-text-xs)",
                          color: "var(--cs-fg-muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {ed.tag}
                      </span>
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

                    {/* Includes list */}
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

      {/* ===== À-la-carte marketplace pointer — the catalog now lives on /modules, the
              configurator on /build (ADR-0191, split so no one page does four jobs). ===== */}
      <Reveal>
        <Section
          id="modules"
          eyebrow="À la carte"
          title="Compose your own edition."
          lede="Every module composes onto the shared base — take one, take several, or price a full stack. The catalog and the configurator each get their own room now."
          band="surface"
        >
          <div
            style={{
              marginTop: "var(--cs-space-8)",
              display: "flex",
              gap: "var(--cs-space-3)",
              flexWrap: "wrap",
            }}
          >
            <Button href="/build" variant="primary">
              Build a stack
            </Button>
            <Button href="/modules" variant="ghost">
              Browse the module catalog
            </Button>
          </div>
        </Section>
      </Reveal>

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

      {/* ===== Subscription plans ===== */}
      <Section
        id="subscriptions"
        eyebrow="Subscriptions"
        title="Own it once, or subscribe to keep it current."
        lede="Regulations don&rsquo;t hold still. The codebase is yours either way — subscriptions deliver the parts that move: framework maps, evidence-pack refreshes, and developer credits."
        band="tint"
      >
        <FeatureGrid cols={2}>
          {SUB_META.map((sub, i) => {
            const plan = PLAN_PRICES.find((p) => p.id === sub.id);
            return (
              <Reveal key={sub.id} delay={i * 80}>
                <div id={sub.id}>
                  <Card>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "var(--cs-space-3)",
                      }}
                    >
                      <span className="cs-card-title">
                        {plan?.label ?? sub.id}
                      </span>
                      {plan && (
                        <span
                          className="cs-num"
                          style={{
                            fontFamily: "var(--cs-font-mono)",
                            fontSize: "var(--cs-text-xl)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatPrice(plan)}
                        </span>
                      )}
                    </div>

                    <p
                      className="cs-muted"
                      style={{
                        marginTop: "var(--cs-space-3)",
                        fontSize: "var(--cs-text-sm)",
                      }}
                    >
                      {sub.audience}
                    </p>

                    <ul
                      style={{
                        margin: "var(--cs-space-4) 0 0",
                        padding: 0,
                        listStyle: "none",
                        display: "grid",
                        gap: "var(--cs-space-2)",
                      }}
                    >
                      {sub.includes.map((item) => (
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

                    <div style={{ marginTop: "var(--cs-space-6)" }}>
                      <CheckoutCta
                        edition={sub.id}
                        href={`/dashboard/plan?plan=${sub.id}`}
                        variant="ghost"
                      >
                        Subscribe
                      </CheckoutCta>
                    </div>
                  </Card>
                </div>
              </Reveal>
            );
          })}
        </FeatureGrid>

        {/* Enterprise — custom procurement, no fixed price (ADR-0106: "Contact us"). */}
        {enterprise && (
          <Reveal delay={160}>
            <div id={enterprise.id} style={{ marginTop: "var(--cs-space-6)" }}>
              <Card>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: "var(--cs-space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="cs-card-title">{enterprise.label}</span>
                  <span
                    className="cs-num"
                    style={{
                      fontFamily: "var(--cs-font-mono)",
                      fontSize: "var(--cs-text-xl)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatPrice(enterprise)}
                  </span>
                </div>
                <p
                  className="cs-muted"
                  style={{
                    marginTop: "var(--cs-space-3)",
                    fontSize: "var(--cs-text-sm)",
                  }}
                >
                  {enterprise.note}
                </p>
                <div style={{ marginTop: "var(--cs-space-6)" }}>
                  <Button
                    href="mailto:security@caisson.sh"
                    external
                    variant="ghost"
                  >
                    Contact us
                  </Button>
                </div>
              </Card>
            </div>
          </Reveal>
        )}
      </Section>

      {/* ===== Licensing — what's open, what you're paying for ===== */}
      <Reveal>
        <Section
          id="licensing"
          eyebrow="Licensing"
          title="What's open, what you're paying for."
          lede={
            <>
              The base substrate — kernel, auth, tenancy-rls, ui, billing,
              credits, jobs, email, ai-config, mcp-server, registry-schema,
              observability, and the generator tooling (cli, migrate,
              license-verify) — is <code className="mono">Apache-2.0</code>,
              free to use. What you buy above is the four editions, the
              compliance primitives (field-crypto, audit-worm), the registry
              service, and Compliance Updates — under the{" "}
              <Link href="/legal/license" className="mono">
                Commercial License
              </Link>
              .
            </>
          }
        />
      </Reveal>

      {/* ===== Get started ===== */}
      <Reveal>
        <Section
          id="get-started"
          eyebrow="Get started"
          title="Start building on the audited substrate."
          lede="The base is built and tested. Pick a module or an edition, scaffold a project, and own the source from day one."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <Terminal
              label="npx create-caisson@latest"
              status={<StatusChip label="ready" tone="success" dot />}
            >
              {
                "$ npx create-caisson@latest\n✓ Caisson base substrate initialized\n✓ Fail-closed RLS (FORCE) + cross-tenant isolation tests\n✓ Append-only audit chain — SHA-256 verified\n✓ Field encryption — per-tenant DEK (HKDF-SHA256)\n✓ Standards gate — lint · test · golden-file"
              }
            </Terminal>
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-3)",
              flexWrap: "wrap",
              marginTop: "var(--cs-space-6)",
            }}
          >
            <Button href="#compliance" variant="primary">
              Get Compliance
            </Button>
            <Button href="/docs" variant="ghost">
              Read the docs
            </Button>
          </div>
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <UpdatesForm source="pricing" />
          </div>
        </Section>
      </Reveal>
    </>
  );
}
