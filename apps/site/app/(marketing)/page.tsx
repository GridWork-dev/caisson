import {
  Button,
  Card,
  CodeBlock,
  CredentialStrip,
  EditionCard,
  Hero,
  Icon,
  Reveal,
  Section,
  SkuMatrix,
  StatusChip,
} from "@/components";
import Link from "next/link";

import { HomeHeroMotion } from "@/components/home-hero-motion";
import { serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import { formatPrice, priceById } from "@/lib/pricing";

// Edition entry price for the SKU grid (ADR-0082, committed) — read from the single pricing
// source so the number never drifts. Guarded for the strict noUncheckedIndexedAccess lookup.
function editionPrice(id: string): string {
  const p = priceById(id);
  return p ? formatPrice(p) : "—";
}

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
            <Button href="/pricing" variant="primary">
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
            <HomeHeroMotion />
            <CodeBlock
              label="install"
              code={
                <>
                  <span className="cs-tok-muted">$</span> npx{" "}
                  <span className="cs-tok-accent">create-caisson</span>@latest
                </>
              }
            />
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
          <div
            className="cs-grid cs-grid--3"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
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
          </div>
        </Section>
      </Reveal>

      {/* ===== Editions — featured-lead hierarchy, one accent ===== */}
      <Reveal>
        <Section
          eyebrow="Editions"
          title="One umbrella. No orphaned modules."
          lede="Compliance is the front door. Each edition is a composition of the same audited base — never a fork."
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
              status={<StatusChip tone="accent" dot label="Hero" />}
              line="Fail-closed RLS, S3 WORM, append-only audit chain, per-tenant field encryption, and a SOC 2 / HIPAA evidence-pack generator."
              proof="ALTER TABLE evidence FORCE ROW LEVEL SECURITY;"
            />
            <EditionCard
              href="/ai-kit"
              name="AI Production Kit"
              icon="gauge"
              status={<StatusChip tone="muted" dot label="#2" />}
              line="The production-rigor layer cheap AI boilerplate skips: token metering, spend caps, a circuit breaker, an eval harness in CI, and guardrails."
              proof="eval gate: regression detected → CI fails"
            />
            <EditionCard
              href="/local-first"
              name="Local-first AI"
              icon="cpu"
              status={<StatusChip tone="muted" dot label="Self-host" />}
              line="Compute seam, privacy gate, and on-device vector search. Your data never leaves the device. Own the source."
              proof="egress: blocked at the privacy gate"
            />
            <EditionCard
              href="/agentic-dev"
              name="Agentic-Dev"
              icon="git-branch"
              status={<StatusChip tone="muted" dot label="Roadmap" />}
              line="The governed-agent kernel: typed agent/skill/rule schema, a lifecycle state machine, and a hooks dispatcher."
              proof="agent · skill · rule — typed, validated, hooked"
            />
          </div>
        </Section>
      </Reveal>

      {/* ===== SKU matrix — editions × modules + committed price row ===== */}
      <Reveal>
        <Section
          eyebrow="What&rsquo;s in each edition"
          title="Compose, don&rsquo;t fork."
          lede="Every edition draws from the same audited base. Modules differ by composition, never by a divergent copy."
        >
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <SkuMatrix
              columns={["Compliance", "AI Kit", "Local-first", "Agentic-Dev"]}
              rows={[
                { label: "Fail-closed RLS", cells: [true, true, true, true] },
                {
                  label: "WORM evidence store",
                  cells: [true, false, false, false],
                },
                {
                  label: "Append-only audit chain",
                  cells: [true, true, false, true],
                },
                {
                  label: "Per-tenant field crypto",
                  cells: [true, false, true, false],
                },
                {
                  label: "Evidence-pack generator",
                  cells: [true, false, false, false],
                },
                {
                  label: "Token metering · spend caps",
                  cells: [false, true, false, false],
                },
                {
                  label: "Eval harness in CI",
                  cells: [false, true, false, true],
                },
                {
                  label: "On-device vector search",
                  cells: [false, false, true, false],
                },
                {
                  label: "Governed-agent kernel",
                  cells: [false, false, false, true],
                },
                {
                  label: "Price",
                  cells: [
                    editionPrice("compliance"),
                    editionPrice("ai-kit"),
                    editionPrice("local-first"),
                    editionPrice("agentic-dev"),
                  ],
                },
              ]}
            />
            <p
              className="cs-footnote"
              style={{ marginTop: "var(--cs-space-5)" }}
            >
              One-time perpetual unless marked /mo.{" "}
              <Link href="/pricing" style={{ color: "var(--cs-link)" }}>
                See the full lineup
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
              Caisson is built and supported by Liam at GridWork Digital — a
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
          lede="Scaffold the audited base in one command, then add the edition you need."
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
                  <span className="cs-tok-muted">$</span> npx{" "}
                  <span className="cs-tok-accent">create-caisson</span>@latest
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
              <Button href="/pricing" variant="primary">
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
