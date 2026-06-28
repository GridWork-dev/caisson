import {
  Button,
  Card,
  Hero,
  Icon,
  Reveal,
  Section,
  SkuMatrix,
  StatusChip,
  Terminal,
} from "@/components";
import { WaitlistForm } from "@/components/waitlist-form";
import { breadcrumb, serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  EDITION_PRICES,
  PLAN_PRICES,
  PRICING_DISCLAIMER,
  PRICING_DISCLAIMER_SHORT,
  formatPrice,
  priceById,
} from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Pricing",
  description:
    "Caisson edition licenses one-time perpetual, an everything bundle, per-module à la carte, and two subscription plans. Indicative pricing — final numbers set before launch.",
  path: "/pricing",
});

// ---- Local helper — safe null-guard for noUncheckedIndexedAccess ----
function editionPrice(id: string): string {
  const p = priceById(id);
  return p ? formatPrice(p) : "—";
}

// ---- Edition metadata (visual + copywriting; price comes from the pricing lib) ----
type EditionMeta = {
  readonly id: string;
  readonly tag: string;
  readonly accent: boolean;
  readonly cta: string;
  readonly ctaHref: string;
  readonly includes: readonly string[];
};

const EDITION_META: readonly EditionMeta[] = [
  {
    id: "compliance",
    tag: "Hero edition",
    accent: true,
    cta: "Request early access",
    ctaHref: "#waitlist",
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
    cta: "Request early access",
    ctaHref: "#waitlist",
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
    tag: "Free · AGPL",
    accent: false,
    cta: "Read the docs",
    ctaHref: "/docs",
    includes: [
      "Compute seam — same code, on-device or hosted",
      "Privacy gate enforcing the no-egress boundary",
      "sqlite-vec ANN for on-device vector search",
      "Offline license + local store",
      "AGPL core — fork it, run it, ship it",
    ],
  },
  {
    id: "agentic-dev",
    tag: "Roadmap",
    accent: false,
    cta: "Join the list",
    ctaHref: "#waitlist",
    includes: [
      "Typed agent / skill / rule schema",
      "Lifecycle state machine for governed runs",
      "Hooks dispatcher for side-effect consolidation",
      "Capability → agent routing",
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
// Rows ordered: shared base first, then per-edition modules, then indicative price.
const SKU_COLUMNS = [
  "Compliance",
  "AI Kit",
  "Local-first",
  "Agentic-Dev",
] as const;

const SKU_ROWS: readonly {
  label: string;
  cells: readonly (boolean | string)[];
}[] = [
  { label: "Postgres base substrate", cells: [true, true, true, true] },
  {
    label: "Fail-closed RLS (FORCE)",
    cells: [true, false, false, false],
  },
  { label: "WORM evidence store", cells: [true, false, false, false] },
  { label: "Append-only audit chain", cells: [true, false, false, false] },
  {
    label: "Per-tenant field encryption",
    cells: [true, false, false, false],
  },
  {
    label: "Evidence-pack generator",
    cells: [true, false, false, false],
  },
  {
    label: "Token metering · spend caps",
    cells: [false, true, false, false],
  },
  { label: "Eval harness in CI", cells: [false, true, false, false] },
  {
    label: "On-device vector search",
    cells: [false, false, true, false],
  },
  {
    label: "Privacy gate (no-egress)",
    cells: [false, false, true, false],
  },
  {
    label: "Governed-agent kernel",
    cells: [false, false, false, true],
  },
  {
    label: "Indicative price",
    cells: [
      editionPrice("compliance"),
      editionPrice("ai-kit"),
      "Free",
      editionPrice("agentic-dev"),
    ],
  },
];

export default function PricingPage() {
  // JSON-LD — breadcrumb + one SoftwareApplication per paid edition
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

  // Split plan types for the "own it or subscribe" framing section
  const oneTimePlans = PLAN_PRICES.filter((p) => p.unit === "once");
  const subscriptionPlans = PLAN_PRICES.filter((p) => p.unit === "month");

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

      {/* ===== Pricing disclaimer banner — prominent per ADR-0081 ===== */}
      <Section band="tint" flush>
        <p
          role="note"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--cs-space-3)",
            margin: 0,
          }}
        >
          <StatusChip label={PRICING_DISCLAIMER} tone="muted" dot />
        </p>
      </Section>

      {/* ===== Hero ===== */}
      <Hero
        eyebrow="Pricing"
        title="Own the code, or subscribe."
        lede="Buy an edition outright — perpetual source, no renewal gate. Or layer a subscription for the framework updates and developer credits that keep it current."
        ctas={
          <>
            <Button href="#waitlist" variant="primary">
              Request early access
            </Button>
            <Button href="/docs" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        artifact={
          <Terminal
            label="caisson entitlements"
            status={<StatusChip label="active" tone="success" dot />}
          >
            {"$ caisson entitlements\nedition."}
            <span className="cs-tok-accent">compliance</span>
            {"        owned     "}
            <span className="cs-tok-muted">one-time</span>
            {"\nsub."}
            <span className="cs-tok-accent">compliance-updates</span>
            {"    "}
            <span className="cs-tok-success">active</span>
            {"    framework-maps @ 2026.6\nsub."}
            <span className="cs-tok-accent">developer</span>
            {"             "}
            <span className="cs-tok-success">active</span>
            {"    private-registry + credits\naddon.eu-ai-act           "}
            <span className="cs-tok-muted">available</span>
            {" registry-gated"}
          </Terminal>
        }
      />

      {/* ===== Edition cards ===== */}
      <Section
        id="editions"
        eyebrow="Editions"
        title="Four editions, one audited base."
        lede="Each edition is a composition of the same substrate — never a fork. Compliance is the front door."
      >
        <div
          className="cs-grid cs-grid--2"
          style={{ marginTop: "var(--cs-space-8)" }}
        >
          {EDITION_META.map((ed, i) => {
            const price = priceById(ed.id);
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

                    {/* Indicative price */}
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
                    <p
                      style={{
                        marginTop: "var(--cs-space-1)",
                        fontSize: "var(--cs-text-xs)",
                        fontFamily: "var(--cs-font-mono)",
                        color: "var(--cs-fg-muted)",
                      }}
                    >
                      {PRICING_DISCLAIMER_SHORT}
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

                    {/* CTA */}
                    <div style={{ marginTop: "var(--cs-space-6)" }}>
                      <Button
                        href={ed.ctaHref}
                        variant={ed.accent ? "primary" : "ghost"}
                      >
                        {ed.cta}
                      </Button>
                    </div>
                  </Card>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* ===== SKU matrix — editions × modules so buyers see what lands where ===== */}
      <Reveal>
        <Section
          eyebrow="What&rsquo;s in each edition"
          title="Compose, don&rsquo;t fork."
          lede="The base substrate ships with every edition. Module rows show which controls land in which edition. The price row uses indicative anchors."
          band="surface"
        >
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <SkuMatrix columns={[...SKU_COLUMNS]} rows={SKU_ROWS} />
            <p
              className="cs-footnote"
              style={{ marginTop: "var(--cs-space-5)" }}
            >
              {PRICING_DISCLAIMER}
            </p>
          </div>
        </Section>
      </Reveal>

      {/* ===== Commerce model — "own it or subscribe" framing ===== */}
      <Section
        eyebrow="How it&rsquo;s sold"
        title="Own it once, or subscribe to keep it current."
        lede="Regulations don&rsquo;t hold still. The codebase is yours either way — subscriptions deliver the parts that move: framework maps, evidence-pack refreshes, and developer credits."
      >
        <div
          className="cs-grid cs-grid--2"
          style={{ marginTop: "var(--cs-space-8)" }}
        >
          {/* One-time column */}
          <Reveal>
            <Card accent>
              <div className="cs-card-title">One-time perpetual</div>
              <p
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                Buy an edition outright. You own the source — fork it, ship it,
                keep it. No renewal gate. Updates are a choice, not a lock.
              </p>

              {/* Edition one-time anchors */}
              <ul
                style={{
                  margin: "var(--cs-space-5) 0 0",
                  padding: 0,
                  listStyle: "none",
                  display: "grid",
                  gap: "var(--cs-space-2)",
                }}
              >
                {EDITION_PRICES.map((p) => (
                  <li
                    key={p.id}
                    className="cs-muted"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: "var(--cs-space-4)",
                      fontSize: "var(--cs-text-sm)",
                    }}
                  >
                    <span>{p.label}</span>
                    <span
                      className="cs-num"
                      style={{
                        fontFamily: "var(--cs-font-mono)",
                        whiteSpace: "nowrap",
                        color: "var(--cs-fg)",
                      }}
                    >
                      {formatPrice(p)}
                    </span>
                  </li>
                ))}
                {/* Bundle + per-module */}
                {oneTimePlans.map((p) => (
                  <li
                    key={p.id}
                    className="cs-muted"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: "var(--cs-space-4)",
                      fontSize: "var(--cs-text-sm)",
                    }}
                  >
                    <span>{p.label}</span>
                    <span
                      className="cs-num"
                      style={{
                        fontFamily: "var(--cs-font-mono)",
                        whiteSpace: "nowrap",
                        color: "var(--cs-fg)",
                      }}
                    >
                      {formatPrice(p)}
                    </span>
                  </li>
                ))}
              </ul>

              <p
                className="cs-footnote"
                style={{ marginTop: "var(--cs-space-4)" }}
              >
                {PRICING_DISCLAIMER_SHORT}
              </p>

              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <Button href="#waitlist" variant="primary">
                  Request early access
                </Button>
              </div>
            </Card>
          </Reveal>

          {/* Subscription column */}
          <Reveal delay={120}>
            <Card>
              <div className="cs-card-title">Subscription</div>
              <p
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-sm)",
                }}
              >
                Layer a subscription on any one-time purchase. The kit is yours
                either way — subscriptions deliver the parts that drift as
                regulations move.
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
                {subscriptionPlans.map((p) => (
                  <li
                    key={p.id}
                    className="cs-muted"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: "var(--cs-space-4)",
                      fontSize: "var(--cs-text-sm)",
                    }}
                  >
                    <span>{p.label}</span>
                    <span
                      className="cs-num"
                      style={{
                        fontFamily: "var(--cs-font-mono)",
                        whiteSpace: "nowrap",
                        color: "var(--cs-fg)",
                      }}
                    >
                      {formatPrice(p)}
                    </span>
                  </li>
                ))}
              </ul>

              <p
                className="cs-footnote"
                style={{ marginTop: "var(--cs-space-4)" }}
              >
                {PRICING_DISCLAIMER_SHORT}
              </p>

              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <Button href="#waitlist" variant="ghost">
                  Join the list
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      </Section>

      {/* ===== Subscription plans — detail cards ===== */}
      <Section
        eyebrow="Subscriptions"
        title="Two recurring SKUs, two jobs."
        lede="Compliance Updates keeps the control mappings current. The Developer plan keeps your build fed. Buy either, both, or neither."
        band="tint"
      >
        <div
          className="cs-grid cs-grid--2"
          style={{ marginTop: "var(--cs-space-8)" }}
        >
          {SUB_META.map((sub, i) => {
            const plan = PLAN_PRICES.find((p) => p.id === sub.id);
            return (
              <Reveal key={sub.id} delay={i * 80}>
                <Card>
                  {/* Name + price on one row */}
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

                  <p
                    className="cs-footnote"
                    style={{ marginTop: "var(--cs-space-4)" }}
                  >
                    {PRICING_DISCLAIMER_SHORT}
                  </p>

                  <div style={{ marginTop: "var(--cs-space-6)" }}>
                    <Button href="#waitlist" variant="ghost">
                      Join the list
                    </Button>
                  </div>
                </Card>
              </Reveal>
            );
          })}
        </div>

        {/* EU AI Act add-on note */}
        <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
          EU AI Act Annex IV ships as an entitlement-gated add-on — sold
          worldwide, registry-scoped, available inside Compliance Updates. The
          named slot exists today; the module ships when demand confirms it.
        </p>
      </Section>

      {/* ===== Waitlist ===== */}
      <Reveal>
        <Section
          id="waitlist"
          eyebrow="Early access"
          title="Numbers land with the invite."
          lede="Join the early-access list. We&rsquo;ll send pricing and an editions walkthrough as each one opens."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <WaitlistForm source="pricing" />
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-8)" }}>
            And yes — it&rsquo;s a better base than the $199 kits.
          </p>
        </Section>
      </Reveal>
    </>
  );
}
