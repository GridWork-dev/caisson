import {
  Button,
  Card,
  CodeBlock,
  BundleCard,
  Icon,
  Reveal,
  Section,
  SkuMatrix,
  StatusChip,
} from "@/components";
import { DualDoorHero } from "@/components/dual-door-hero";
import {
  IsolationDiagram,
  LifecycleDiagram,
} from "@/components/isolation-diagrams";
import { RepoArtifact } from "@/components/repo-artifact";
import { StackBuilder } from "@/components/stack-builder";
import Link from "next/link";

import { serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  bundlePrice,
  BUNDLE_PRICES,
  everythingSavings,
  formatUsd,
  MODULE_PRICES,
  moduleCatalogSubtotal,
  modulesByBundle,
  PLAN_PRICES,
  planPrice,
  SKU_COLUMNS,
  SKU_FEATURE_ROWS,
} from "@/lib/pricing";

export const metadata = buildMetadata({
  description:
    "One audited Postgres base for regulated and production SaaS — fail-closed RLS, S3 Object-Lock WORM, an append-only audit chain, and six composable bundles you compose, never fork.",
  path: "/",
});

// Umbrella SoftwareApplication node — no priceId (the home node is the product line, not a SKU).
// Describes the two-door umbrella (ADR-0040): the compliance wedge under a production-rigor layer.
const homeJsonLd = softwareApplication({
  name: "Caisson",
  description:
    "Composable infrastructure for regulated and production SaaS on one audited Postgres base — fail-closed RLS, S3 Object-Lock WORM, an append-only audit chain, token metering, on-device inference, and signed provenance, in six bundles.",
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
const HOW_TO_BUY_MODULE_PRICE = planPrice("module");
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

      {/* ===== Dual-door hero (D1) — compliance wedge (lead) + production umbrella (secondary) ===== */}
      <DualDoorHero />

      {/* ===== The umbrella / named enemy ===== */}
      <Reveal>
        <Section
          eyebrow="The umbrella"
          title="The load-bearing infrastructure cheap boilerplates skip."
          lede="Happy-path starter kits get you a login screen. They do not get you through an audit. Retrofitting RLS, WORM storage, and an audit chain into a live multi-tenant database costs months. Start with them."
          band="surface"
        />
      </Reveal>

      {/* ===== Evidence row — three controls, each with its receipt. Static header, cards cascade
          in (stagger) — the first "showcase" beat of the authored rhythm (ADR-0307). ===== */}
      <Section
        eyebrow="What ships in the box"
        title="Prevention at the application layer — with the receipts."
        lede="Each control ships with a live artifact you can read, run, and hand to an auditor. No diagrams standing in for behaviour."
      >
        <Reveal stagger={70} className="cs-grid cs-grid--3 cs-feature-grid">
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
        </Reveal>
      </Section>

      {/* ===== Honest-artifact bento (D4a) — the repo IS the artifact: real paths + real code. A
          taller rise (distance 18) marks the big artifact block as its own beat (ADR-0307). ===== */}
      <Reveal distance={18}>
        <Section
          eyebrow="The repository is the artifact"
          title="Real paths. Real code. No screenshots."
          lede="The structure of this page is the structure of the codebase. Every path is a real directory; every snippet is copied verbatim from the file its header names — the honest-artifact floor, not a mockup."
        >
          <RepoArtifact />
        </Section>
      </Reveal>

      {/* ===== Architecture-isolation + data-lifecycle diagram pair (D4b) — drawn to real behaviour.
          Header fades; the two diagram blocks slide in laterally, staggered — a sideways beat that
          sets "how it works" apart from the vertical rises around it (ADR-0307). ===== */}
      <Reveal direction="none">
        <Section
          eyebrow="How the guarantees hold"
          title="The boundary and the evidence trail, drawn to real behaviour."
          lede="Two diagrams of shipped behaviour — the fail-closed isolation boundary and the write-to-verify evidence lifecycle. Nothing aspirational: this is what the RLS, audit-chain, and WORM modules already do."
          band="surface"
        >
          <Reveal
            as="div"
            stagger={120}
            direction="left"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--cs-space-12)",
              marginTop: "var(--cs-space-8)",
            }}
          >
            <div>
              <h3 className="cs-card-title">
                Per-tenant isolation, fail-closed
              </h3>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)", maxWidth: "60ch" }}
              >
                Tenant context sets one Postgres GUC; the FORCE policy denies
                any row that doesn&apos;t match it. A query that never set the
                context returns nothing, never everything.
              </p>
              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <IsolationDiagram />
              </div>
            </div>
            <div>
              <h3 className="cs-card-title">
                Evidence lifecycle, write to verify
              </h3>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)", maxWidth: "60ch" }}
              >
                Every privileged write joins the append-only chain, anchors to
                WORM under S3 Object-Lock, and stays verifiable and exportable
                as an evidence pack.
              </p>
              <div style={{ marginTop: "var(--cs-space-6)" }}>
                <LifecycleDiagram />
              </div>
            </div>
          </Reveal>
        </Section>
      </Reveal>

      {/* ===== How to buy — the Module/Bundle/Plan type-chip vocabulary, defined once before
          the Bundles cards below reuse it (ADR-0237 F5) ===== */}
      <Section
        eyebrow="How to buy"
        title="Module, bundle, or plan — same catalog, three shapes."
        lede="Every price on this site now carries one of three labels. Pick the shape that fits and open the marketplace to browse the rest."
      >
        <Reveal stagger={70} className="cs-grid cs-grid--3 cs-feature-grid">
          <Card>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "var(--cs-space-3)",
              }}
            >
              <span className="cs-card-title">One capability, standalone</span>
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
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
              A single package sold on its own — field encryption, the eval
              harness, the agent runner. Every module, priced à la carte.
            </p>
            <div style={{ marginTop: "var(--cs-space-6)" }}>
              <Button href="/marketplace?type=modules" variant="ghost">
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
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
              Compliance, AI-Production, Local-first, Agentic-Dev, or Provenance
              — each composes the same audited base, never a fork. Everything
              takes the whole catalog at {bundlePrice("everything")}.
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
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
              Compliance Updates keeps control mappings and evidence packs
              current. Developer adds credits and private-registry pulls.
            </p>
            <div style={{ marginTop: "var(--cs-space-6)" }}>
              <Button href="/marketplace/plans" variant="ghost">
                Browse plans
              </Button>
            </div>
          </Card>
        </Reveal>
      </Section>

      {/* ===== Bundles — featured-lead hierarchy, one accent. id="bundles" is the production
          door's target from the dual-door hero (D1). Six cards cascade in — the signature beat
          of the authored rhythm (ADR-0307). ===== */}
      <Section
        id="bundles"
        eyebrow="Bundles"
        title="Six bundles, one audited base."
        lede="Compliance leads; every bundle — Provenance and the whole-catalog Everything included — draws from the same audited base, never a fork."
        band="surface"
      >
        <Reveal
          stagger={70}
          className="cs-editions"
          style={{ marginTop: "var(--cs-space-8)" }}
        >
          <BundleCard
            lead
            href="/compliance"
            name="Compliance"
            icon="fail-closed"
            status={
              <StatusChip
                tone="accent"
                dot
                label={`${bundlePrice("compliance")} · ${modulesByBundle("compliance").length} modules`}
              />
            }
            line="Fail-closed RLS, S3 WORM, append-only audit chain, per-tenant field encryption, and a SOC 2 / HIPAA evidence-pack generator."
            proof="ALTER TABLE evidence FORCE ROW LEVEL SECURITY;"
          />
          <BundleCard
            href="/ai-kit"
            name="AI-Production"
            icon="gauge"
            status={
              <StatusChip
                tone="muted"
                dot
                label={`${bundlePrice("ai-production")} · ${modulesByBundle("ai-production").length} modules`}
              />
            }
            line="The production-rigor layer cheap AI boilerplate skips: token metering, spend caps, a circuit breaker, versioned prompts, and guardrails."
            proof="breaker open: tenant spend cap hit"
          />
          <BundleCard
            href="/local-first"
            name="Local-first AI"
            icon="cpu"
            status={
              <StatusChip
                tone="muted"
                dot
                label={`${bundlePrice("local-first")} · ${modulesByBundle("local-first").length} modules`}
              />
            }
            line="Compute seam, privacy gate, and on-device vector search. Your data never leaves the device. Own the source."
            proof="egress: blocked at the privacy gate"
          />
          <BundleCard
            href="/agentic-dev"
            name="Agentic-Dev"
            icon="git-branch"
            status={
              <StatusChip
                tone="muted"
                dot
                label={`${bundlePrice("agentic-dev")} · ${modulesByBundle("agentic-dev").length} modules`}
              />
            }
            line="The governed-agent kernel: typed agent/skill/rule schema, a lifecycle state machine, and a hooks dispatcher."
            proof="agent · skill · rule — typed, validated, hooked"
          />
          <BundleCard
            href="/provenance"
            name="Provenance"
            icon="audit-chain"
            status={
              <StatusChip
                tone="muted"
                dot
                label={`${bundlePrice("provenance")} · ${modulesByBundle("provenance").length} modules`}
              />
            }
            line="Detached Ed25519 + RFC-3161 signing, an append-only audit chain where one altered row breaks every link after it, and per-tenant field encryption."
            proof="caisson evidence verify pack.json  →  sig ✓ · tsa ✓ · root 2c9f…b7"
          />
          <BundleCard
            // Whole-catalog closer spans the row like the Compliance lead, but stays a
            // neutral surface — `lead`'s accent identity belongs to the hero card alone.
            style={{ gridColumn: "1 / -1" }}
            href="/marketplace?view=bundle:everything"
            name="Everything"
            icon="bundle"
            status={
              <StatusChip
                tone="muted"
                dot
                label={`${bundlePrice("everything")} · all ${MODULE_PRICES.length} modules`}
              />
            }
            line="Every bundle and every module, including the platform capabilities no persona bundle carries — one purchase, the whole library."
            proof={`save ${formatUsd(everythingSavings())} vs ${formatUsd(moduleCatalogSubtotal())} à la carte`}
          />
        </Reveal>
      </Section>

      {/* ===== SKU matrix — bundles × modules + committed price row ===== */}
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
              <Link href="/marketplace" className="cs-link">
                Browse the full marketplace
              </Link>
            </p>
          </div>
        </Section>
      </Reveal>

      {/* ===== Bundle-builder calculator (D4c) — the embedded StackBuilder, prices from the SOT ===== */}
      <Reveal>
        <Section
          eyebrow="Bundle builder"
          title="Build your own stack — watch the running total."
          lede="Pick the modules you need and see the total. When your picks total more than a bundle covers, the builder points at the cheaper path — the arithmetic, not a fabricated discount. Every figure reads from the committed catalog."
        >
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <StackBuilder />
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            <Link href="/marketplace" className="cs-link">
              Build your stack on the full marketplace
            </Link>
          </p>
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

      {/* ===== Named-engineer note — a real human supports it (ADR-0080 §2). A quiet fade, no rise
          — the trust beat settles into focus rather than moving (ADR-0307). ===== */}
      <Reveal direction="none">
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
              Caisson is a software product, built and backed by the maintainer at
              GridWork Digital — a named engineer, not a ticket queue. Buy a
              license and you get a direct line to the engineer who builds it.
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

      {/* ===== Built in the open — the interim social-proof answer (ADR-0272 §4 / ADR-0273).
          Static header, three check-cards cascade in (ADR-0307). ===== */}
      <Section
        eyebrow="Built in the open"
        title="No logo wall yet. Here's what you can check instead."
        lede="We're early — no logo wall to point at yet, and we'd rather say that than fake one. Here's what you can verify instead: the base is open source you can read, the changelog is public, and the source ships to you to audit."
        band="surface"
      >
        <Reveal stagger={70} className="cs-grid cs-grid--3 cs-feature-grid">
          <Card>
            <div className="cs-status">
              <Icon name="check" size="lg" />
              Open Apache-2.0 Base
            </div>
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
              15 base packages — the kernel, auth, tenant isolation, billing,
              and the generator tooling — ship under Apache-2.0. Read them,
              audit them, and share them: the base is peer-reviewable by the
              license every buyer receives it under.
            </p>
            <div style={{ marginTop: "var(--cs-space-5)" }}>
              <Button href="/legal/license" variant="ghost">
                What&rsquo;s open
              </Button>
            </div>
          </Card>
          <Card>
            <div className="cs-status">
              <Icon name="git-branch" size="lg" />A public changelog
            </div>
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
              Every release is logged in the open, in plain English — what
              shipped, release by release. No private roadmap you have to take
              on faith, and the buyer dashboard shows your own live
              updates-window.
            </p>
            <div style={{ marginTop: "var(--cs-space-5)" }}>
              <Button href="/updates" variant="ghost">
                Read the updates
              </Button>
            </div>
          </Card>
          <Card>
            <div className="cs-status">
              <Icon name="users" size="lg" />
              Be an early reference
            </div>
            <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
              A limited first cohort of design partners gets discounted access
              in exchange for a citable case study and a direct line to the
              engineer. A reference partnership — not a waitlist.
            </p>
            <div style={{ marginTop: "var(--cs-space-5)" }}>
              <Button href="/partners" variant="ghost">
                Design partners
              </Button>
            </div>
          </Card>
        </Reveal>
        <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
          Handing this to a security review?{" "}
          <Link href="/evidence" className="cs-link">
            See the evidence pack
          </Link>
        </p>
      </Section>

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
                  <span className="cs-tok-muted">$</span> bunx{" "}
                  <span className="cs-tok-accent">@caisson-sh/cli</span>@latest
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
