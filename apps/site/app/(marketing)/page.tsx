import {
  Button,
  Card,
  CodeBlock,
  CredentialStrip,
  EditionCard,
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

import { serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  BUNDLE_PRICES,
  editionPrice,
  formatUsd,
  PLAN_PRICES,
  SKU_COLUMNS,
  SKU_FEATURE_ROWS,
} from "@/lib/pricing";

export const metadata = buildMetadata({
  description:
    "Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain — wired and tested before your first customer, not backfilled after your first audit.",
  path: "/",
});

// Umbrella SoftwareApplication node — no priceId (the home node is the product line, not a SKU).
const homeJsonLd = softwareApplication({
  name: "Caisson",
  description:
    "Compliance-grade infrastructure for regulated SaaS — fail-closed Postgres RLS, S3 Object-Lock WORM, an append-only audit chain, and an evidence-pack generator.",
  url: SITE_URL,
});

// Evidence cards — each pairs a bespoke icon with a one-line mono proof artifact and the
// control/clause it answers (ADR-0080 §4: control+clause tags on the home evidence cards).
const EVIDENCE = [
  {
    icon: "rls",
    label: "Fail-closed RLS",
    body: "Postgres row-level security with FORCE — a query that never set the tenant context returns nothing, never everything. Cross-tenant isolation is a test in CI, not a convention you hope each developer remembers.",
    proof: "ALTER TABLE invoices FORCE ROW LEVEL SECURITY;",
    maps: "SOC 2 CC6.1 · HIPAA §164.312(a)(1)",
  },
  {
    icon: "worm",
    label: "WORM storage",
    body: "S3 Object-Lock in compliance mode. Inside the retention window an evidence object cannot be overwritten or deleted — not by an application bug, not by an operator, not by a leaked root key.",
    proof: "ObjectLockMode: COMPLIANCE · Retain: 7y",
    maps: "SOC 2 CC7.2 · HIPAA §164.312(c)(1)",
  },
  {
    icon: "audit-chain",
    label: "Append-only audit chain",
    body: "Every privileged action commits SHA-256 over the previous hash plus its own payload. Tampering with any historical row breaks every link after it — and the break is detectable, provable, and exportable.",
    proof: "sha256(prev ‖ payload) — verifyChain() over every row",
    maps: "SOC 2 CC7.2 · HIPAA §164.312(b)",
  },
] as const;

// CI proof strip (ADR-0080 §2) — only checks that actually run in CI, never fabricated
// specifics. Each line maps to a real job: the turbo build/lint/test pipeline, the standards
// gate, golden-file regression, and the RLS cross-tenant isolation test.
const CI_CHECKS = [
  "build · lint · unit · integration · standards-gate · golden-file — green",
  "RLS cross-tenant read: denied",
] as const;

// How-to-buy price bands — derived from lib/pricing.ts (never hand-duplicated) so the three
// figures on the type-chip cards below can't drift from the SKUs they describe.
const HOW_TO_BUY_MODULE_PRICE = editionPrice("module");
// The persona/Provenance bundle price band (catalog-rework W6.2, ADR-0258 numbers) — the Everything
// bundle is the whole-catalog step above, not part of the "take a bundle" range.
const BUNDLE_AMOUNTS = BUNDLE_PRICES.filter((b) => b.id !== "everything").map(
  (b) => b.amount ?? 0,
);
const HOW_TO_BUY_BUNDLE_RANGE = `${formatUsd(Math.min(...BUNDLE_AMOUNTS))}–${formatUsd(Math.max(...BUNDLE_AMOUNTS))}`;
const YEARLY_PLAN_AMOUNTS = PLAN_PRICES.filter(
  (p): p is typeof p & { amount: number } =>
    p.unit === "year" && p.amount !== null,
).map((p) => p.amount);
const HOW_TO_BUY_PLAN_RANGE = `${formatUsd(Math.min(...YEARLY_PLAN_AMOUNTS))}–${formatUsd(Math.max(...YEARLY_PLAN_AMOUNTS))}/yr`;

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeJsonLd) }}
      />

      {/* ===== Hero — split layout, the denial carries the claim ===== */}
      <Hero
        eyebrow="Compliance-grade infrastructure for regulated SaaS"
        title="Fail-closed by construction."
        lede="Fail-closed Postgres RLS, S3 Object-Lock WORM, and an append-only audit chain — wired and tested before your first customer, not backfilled after your first audit."
        ctas={
          <>
            <Button href="/marketplace" variant="primary">
              Get started
            </Button>
            <Button href="/docs" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={
          <CredentialStrip
            items={["SOC 2", "HIPAA", "GDPR", "EU AI Act"]}
            note="Evidence packs you generate — never &lsquo;we are certified.&rsquo;"
          />
        }
        artifact={
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--cs-space-4)",
            }}
          >
            {/* The denial, as code-as-proof (ADR-0104 hero = static): a query that never set
                the tenant context returns nothing, never everything. */}
            <Terminal
              label="psql — cross-tenant read"
              status={<StatusChip tone="accent" dot label="denied" />}
            >
              <span className="cs-tok-muted">
                -- tenant context was never set
              </span>
              {
                "\n$ SELECT count(*) FROM invoices;\n\n count\n-------\n     0\n(1 row)"
              }
            </Terminal>
            <CodeBlock
              label="install"
              code={
                <>
                  <span className="cs-tok-muted">$</span> bun create{" "}
                  <span className="cs-tok-accent">caisson</span>@latest
                </>
              }
            />
            {/* Signature slot — RESERVED + blank (ADR-0103/0104). The marketing signature is
                deferred-for-rework; a future three.js / CSS-SVG studio-candidate spike mounts
                here. Intentionally renders nothing until then (no fabricated placeholder). */}
          </div>
        }
      />

      {/* ===== The umbrella / named enemy ===== */}
      <Reveal>
        <Section
          eyebrow="The umbrella"
          title="The load-bearing infrastructure cheap boilerplates skip."
          lede="Happy-path starter kits get you a login screen. They do not get you through an audit. Retrofitting RLS, WORM storage, and an audit chain into a live multi-tenant database costs months. Start with them."
          band="surface"
        />
      </Reveal>

      {/* ===== Evidence row — three controls, each with its receipt ===== */}
      <Reveal>
        <Section
          eyebrow="What ships in the box"
          title="Prevention at the application layer — with the receipts."
          lede="Each control ships with a live artifact you can read, run, and hand to an auditor. No diagrams standing in for behaviour."
        >
          <FeatureGrid cols={3}>
            {EVIDENCE.map((e) => (
              <Card key={e.label}>
                <div className="cs-status">
                  <Icon name={e.icon} size="lg" aria-label={e.label} />
                  {e.label}
                </div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {e.body}
                </p>
                <code
                  className="mono"
                  style={{
                    display: "block",
                    marginTop: "var(--cs-space-5)",
                    paddingTop: "var(--cs-space-4)",
                    borderTop: "1px solid var(--cs-border)",
                    fontSize: "var(--cs-text-xs)",
                    color: "var(--cs-fg-muted)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {e.proof}
                </code>
                <p
                  className="cs-footnote"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {e.maps}
                </p>
              </Card>
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== How to buy — the Module/Edition/Plan type-chip vocabulary, defined once before
          the Editions cards below reuse it (ADR-0237 F5) ===== */}
      <Reveal>
        <Section
          eyebrow="How to buy"
          title="Module, bundle, or plan — same catalog, three shapes."
          lede="Every price on this site now carries one of three labels. Pick the shape that fits and open the marketplace to browse the rest."
        >
          <FeatureGrid cols={3}>
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
                  One capability, standalone
                </span>
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
                {HOW_TO_BUY_MODULE_PRICE}
              </p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                A single package sold on its own — field encryption, the eval
                harness, the agent runner. Every module, priced à la carte.
              </p>
              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <Button href="/marketplace/modules" variant="ghost">
                  Browse modules
                </Button>
              </div>
            </Card>
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
                  A composed stack for one job
                </span>
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
                {HOW_TO_BUY_BUNDLE_RANGE}
              </p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Compliance, AI Production, Local-first, Agentic-Dev, or
                Provenance — each bundle composes the same audited base. Never a
                fork.
              </p>
              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <Button href="/marketplace" variant="ghost">
                  Browse bundles
                </Button>
              </div>
            </Card>
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
                  A subscription, not a one-time buy
                </span>
                <StatusChip label="Plan" />
              </div>
              <p
                className="cs-num"
                style={{
                  marginTop: "var(--cs-space-3)",
                  fontSize: "var(--cs-text-2xl)",
                  fontFamily: "var(--cs-font-mono)",
                }}
              >
                {HOW_TO_BUY_PLAN_RANGE}
              </p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Compliance Updates keeps control mappings and evidence packs
                current. Developer adds credits and private-registry pulls.
              </p>
              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <Button href="/marketplace/plans" variant="ghost">
                  Browse plans
                </Button>
              </div>
            </Card>
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Bundles — featured-lead hierarchy, one accent ===== */}
      <Reveal>
        <Section
          eyebrow="Bundles"
          title="Six bundles, one audited base."
          lede="Compliance leads. Every bundle draws from the same audited base — never a fork. Provenance and the whole-catalog Everything bundle round out the six; see them all, plus every module sold on its own, in the marketplace."
          band="surface"
        >
          <div
            className="cs-editions"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            <EditionCard
              lead
              href="/compliance"
              name="Compliance"
              icon="fail-closed"
              status={<StatusChip tone="accent" dot label="Bundle · Hero" />}
              line="Fail-closed RLS, S3 WORM, append-only audit chain, per-tenant field encryption, and a SOC 2 / HIPAA evidence-pack generator."
              proof="ALTER TABLE evidence FORCE ROW LEVEL SECURITY;"
            />
            <EditionCard
              href="/ai-kit"
              name="AI Production Kit"
              icon="gauge"
              status={<StatusChip tone="muted" dot label="Bundle · #2" />}
              line="The production-rigor layer cheap AI boilerplate skips: token metering, spend caps, a circuit breaker, versioned prompts, and guardrails."
              proof="breaker open: tenant spend cap hit"
            />
            <EditionCard
              href="/local-first"
              name="Local-first AI"
              icon="cpu"
              status={
                <StatusChip tone="muted" dot label="Bundle · Self-host" />
              }
              line="Compute seam, privacy gate, and on-device vector search. Your data never leaves the device. Own the source."
              proof="egress: blocked at the privacy gate"
            />
            <EditionCard
              href="/agentic-dev"
              name="Agentic-Dev"
              icon="git-branch"
              status={<StatusChip tone="muted" dot label="Bundle · #4" />}
              line="The governed-agent kernel: typed agent/skill/rule schema, a lifecycle state machine, and a hooks dispatcher."
              proof="agent · skill · rule — typed, validated, hooked"
            />
          </div>
        </Section>
      </Reveal>

      {/* ===== SKU matrix — editions × modules + committed price row ===== */}
      <Reveal>
        <Section
          eyebrow="What&rsquo;s in each bundle"
          title="Compose, don&rsquo;t fork."
          lede="Every bundle draws from the same audited base. Modules differ by composition, never by a divergent copy."
        >
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <SkuMatrix columns={[...SKU_COLUMNS]} rows={SKU_FEATURE_ROWS} />
            <p
              className="cs-footnote"
              style={{ marginTop: "var(--cs-space-5)" }}
            >
              One-time perpetual unless marked /mo.{" "}
              <Link href="/marketplace" style={{ color: "var(--cs-link)" }}>
                Browse the full marketplace
              </Link>
            </p>
          </div>
        </Section>
      </Reveal>

      {/* ===== CI proof strip — the green checks substitute for a logo wall ===== */}
      <Reveal>
        <Section
          eyebrow="Proof, not promises"
          title="Every claim is a check in CI."
          lede="The proof is the pipeline: the controls are verified on every commit, and the run is green."
          band="surface"
        >
          <div className="cs-proof" style={{ marginTop: "var(--cs-space-8)" }}>
            {CI_CHECKS.map((c) => (
              <span key={c} className="cs-proof__check">
                <Icon name="check" aria-label="passing" />
                {c}
              </span>
            ))}
          </div>
        </Section>
      </Reveal>

      {/* ===== Named-engineer note — a real human supports it (ADR-0080 §2) ===== */}
      <Reveal>
        <Section eyebrow="Who&rsquo;s behind it">
          <Card accent>
            <p
              style={{
                fontSize: "var(--cs-text-xl)",
                lineHeight: "var(--cs-leading-relaxed)",
                letterSpacing: "var(--cs-tracking-tight)",
                maxWidth: "60ch",
              }}
            >
              Caisson is built and supported by Liam at Caisson Software — a
              named engineer, not a ticket queue. Every customer gets a direct
              line to the engineer who builds it.
            </p>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "60ch" }}
            >
              The honesty boundary is fixed: Caisson ships the technical
              controls and generates the evidence. Your organizational controls
              and the audit itself remain yours — we never imply a certification
              we don&rsquo;t hold.
            </p>
          </Card>
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Reveal>
        <Section
          id="get-started"
          eyebrow="Get started"
          title="Start audit-ready."
          lede="Scaffold the audited base in one command, then open the marketplace for the bundle, module, or plan you need."
          band="surface"
        >
          <div
            style={{
              marginTop: "var(--cs-space-6)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--cs-space-5)",
              maxWidth: "40rem",
            }}
          >
            <CodeBlock
              label="install"
              code={
                <>
                  <span className="cs-tok-muted">$</span> bun create{" "}
                  <span className="cs-tok-accent">caisson</span>@latest
                </>
              }
            />
            <div
              style={{
                display: "flex",
                gap: "var(--cs-space-3)",
                flexWrap: "wrap",
              }}
            >
              <Button href="/compliance" variant="primary">
                Get Compliance
              </Button>
              <Button href="/docs" variant="ghost">
                Read the docs
              </Button>
            </div>
          </div>
        </Section>
      </Reveal>
    </>
  );
}
