import type { ReactNode } from "react";

import {
  Button,
  Card,
  CredentialStrip,
  Faq,
  Hero,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
  type IconName,
} from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { editionCatalogItem, toCartItem } from "@/lib/catalog";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { formatPrice, priceById } from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Compliance",
  description:
    "Compliance-grade infrastructure for regulated SaaS: fail-closed Postgres RLS, S3 Object-Lock WORM, an append-only audit chain, per-tenant field encryption, and a SOC 2 / HIPAA evidence-pack generator — wired and tested before your first audit, not backfilled after it.",
  path: "/compliance",
});

// Each control ships with a live, one-line artifact (the proof IS the claim — DESIGN.md §9) and the
// framework clause it satisfies. Caisson generates this evidence; it never asserts certification.
const CONTROLS: readonly {
  icon: IconName;
  title: string;
  body: string;
  tags: readonly string[];
  proof: string;
}[] = [
  {
    icon: "rls",
    title: "Fail-closed RLS",
    body: "Every tenant table enables AND forces row-level security, so the policy binds the owner too — no privileged path around it. A query that never set the tenant context returns nothing, not everything.",
    tags: ["SOC 2 CC6.1", "HIPAA §164.312(a)(1)"],
    proof: "SELECT count(*) FROM invoices;  →  ERROR: app.tenant_id not set",
  },
  {
    icon: "worm",
    title: "WORM evidence storage",
    body: "Evidence buckets ship with S3 Object Lock in COMPLIANCE mode and a default retention. Inside the window an object cannot be overwritten or deleted — not by a bug, not by an operator, not by a leaked root key.",
    tags: ["HIPAA §164.312(c)(1)", "SOC 2 CC7.2"],
    proof: "delete-object  →  AccessDenied: WORM-protected until 2033-06-27Z",
  },
  {
    icon: "audit-chain",
    title: "Append-only audit chain",
    body: "Each audit row commits SHA-256 over the previous hash plus its own payload. Tampering with any historical row breaks every link after it — and the break is detectable, provable, and exportable for an auditor.",
    tags: ["HIPAA §164.312(b)", "SOC 2 CC7.2"],
    proof: "caisson audit verify  →  41984 rows · 0 breaks · root 2c9f…b7",
  },
  {
    icon: "field-crypto",
    title: "Per-tenant field encryption",
    body: "Sensitive columns are sealed with a data key derived per tenant from a root KMS key via HKDF-SHA256. A leaked tenant key exposes one tenant, never the table; rotating the root re-derives every key with no re-encrypt scan.",
    tags: ["HIPAA §164.312(a)(2)(iv)"],
    proof: "hkdf(rootKey, tenantId)  →  DEK·A cannot open DEK·B ciphertext",
  },
  {
    icon: "evidence-pack",
    title: "Evidence-pack generator",
    body: "Collects the live RLS policies, the WORM retention config, and an audit-chain proof, maps them to named controls, and writes a dated bundle. The evidence comes from the system that enforces it — not a spreadsheet.",
    tags: ["SOC 2 · HIPAA mapping"],
    proof:
      "soc2-evidence-2026-06-28/: rls-policies.json · worm-retention.json · audit-chain-proof.json",
  },
];

// Visible FAQ (rendered below) — the same items feed the FAQPage JSON-LD. Procurement-shaped
// questions, answered honestly against the technical-vs-administrative boundary (ADR-0080 §3).
const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: "Does Caisson make us SOC 2 or HIPAA certified?",
    answer:
      "No. Caisson ships the technical controls those frameworks require and generates the evidence to prove them. Certification comes from an auditor assessing your whole program — the organizational controls (HR, vendor, incident response) and the audit itself remain yours.",
  },
  {
    question: "Which controls does Caisson actually cover?",
    answer:
      "The technical access and integrity controls: fail-closed RLS (SOC 2 CC6.1, HIPAA §164.312(a)(1)), WORM-retained evidence, an append-only audit chain, and per-tenant field encryption. It does not cover administrative, physical, or policy controls — those stay with you.",
  },
  {
    question: "Can I retrofit this into an existing database?",
    answer:
      "You can, but it is the expensive path. Backfilling RLS, WORM, and an audit chain into a live multi-tenant database runs $80k and 6–9 months of migration with customer data on the line. Caisson wires them in on day one, before tenants ever share rows.",
  },
  {
    question: "How does the evidence pack work?",
    answer:
      "One command collects the live RLS policies, the WORM retention config, and an audit-chain proof, maps them to named controls, and writes a dated bundle. The evidence is read out of the running system, not transcribed into a screenshot or a spreadsheet.",
  },
  {
    question: "Do I own the source?",
    answer:
      "Yes. The one-time Compliance license is perpetual — you own the source for the base, the four controls, and the evidence-pack generator. Compliance Updates is an optional subscription that tracks framework drift so the control mappings stay current.",
  },
];

const compliancePrice = priceById("compliance");

// Cart-ready CatalogItem for the peak-intent buy CTAs below (ADR-0192 single add-to-cart buy-verb).
const _catalogItem = editionCatalogItem("compliance");
const editionCartItem = _catalogItem ? toCartItem(_catalogItem) : undefined;

export default function CompliancePage() {
  const heroArtifact: ReactNode = (
    <Terminal
      label="psql — tenant isolation"
      status={<StatusChip label="denied" tone="muted" dot />}
    >
      {`$ psql -c "select * from invoices"\n`}
      <span className="cs-tok-danger">ERROR:</span>
      {`  permission denied for table invoices\n`}
      {`DETAIL: RLS policy "tenant_isolation" forbids SELECT\n`}
      {`        with no app.tenant_id set — `}
      <span className="cs-tok-accent">fail-closed by default.</span>
    </Terminal>
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            softwareApplication({
              name: "Caisson Compliance",
              description:
                "Fail-closed RLS, WORM evidence storage, an append-only audit chain, per-tenant field encryption, and a SOC 2 / HIPAA evidence-pack generator for regulated SaaS.",
              url: `${SITE_URL}/compliance`,
              priceId: "compliance",
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            breadcrumb([
              { name: "Home", path: "/" },
              { name: "Compliance", path: "/compliance" },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(faqPage([...FAQ])),
        }}
      />

      {/* ===== Hero ===== */}
      <Hero
        eyebrow="Compliance-grade infrastructure for regulated SaaS"
        title="Audit-ready from the first commit."
        lede="The Compliance edition wires the technical controls an auditor asks for — tenant isolation, immutable evidence, and a tamper-evident log — in before your first customer, tested in CI. You start fail-closed, then prove it on demand."
        ctas={
          <>
            {editionCartItem && (
              <AddToCartButton item={editionCartItem} variant="primary" />
            )}
            <Button href="/docs" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={
          <CredentialStrip
            items={[
              "SOC 2 CC6.1",
              "HIPAA §164.312",
              "WORM evidence",
              "Append-only audit",
            ]}
            note="Caisson generates the evidence — the certification is your auditor's call, not ours."
          />
        }
        artifact={heroArtifact}
      />

      {/* ===== The wedge: scanner vs construction ===== */}
      <Reveal>
        <Section
          eyebrow="The compliance wedge"
          title="Compliance prevention at the application layer."
          lede="A scanner is a smoke detector. Caisson is the fail-closed construction — prevention wired in before the fire, not after. Each control below ships with a live artifact you can read, run, and hand to an auditor."
          band="tint"
        >
          <Card accent className="cs-elevate-md">
            <p
              style={{
                fontSize: "var(--cs-text-lg)",
                lineHeight: "var(--cs-leading-relaxed)",
                letterSpacing: "var(--cs-tracking-tight)",
                maxWidth: "60ch",
              }}
            >
              SOC 2 from scratch runs <span className="cs-num">$80k</span> and{" "}
              <span className="cs-num">6–9 months</span>. Retrofitting RLS,
              WORM, and an audit chain into a <em>live</em> multi-tenant
              database is months more — a migration with customer data on the
              line.
            </p>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "60ch" }}
            >
              Both, wired on day one. Once tenants share rows in production,
              isolation becomes a backfill you cannot fully trust. As a default,
              it is just how the schema is built.
            </p>
          </Card>
        </Section>
      </Reveal>

      {/* ===== The five controls (evidence cards) ===== */}
      <Reveal>
        <Section
          eyebrow="What ships in the box"
          title="Five technical controls, each with its proof."
          lede="No diagrams standing in for behaviour. The artifact carries the claim, and each control names the framework clause it satisfies."
        >
          <div className="cs-grid" style={{ marginTop: "var(--cs-space-8)" }}>
            {CONTROLS.map((c, i) => (
              <Reveal key={c.title} delay={i * 60}>
                <Card>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--cs-space-3)",
                    }}
                  >
                    <Icon name={c.icon} size="lg" />
                    <span className="cs-card-title">{c.title}</span>
                  </div>
                  <p
                    className="cs-muted"
                    style={{ marginTop: "var(--cs-space-3)" }}
                  >
                    {c.body}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "var(--cs-space-2)",
                      marginTop: "var(--cs-space-4)",
                    }}
                  >
                    {c.tags.map((t) => (
                      <span key={t} className="cs-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <code
                    className="mono"
                    style={{
                      display: "block",
                      marginTop: "var(--cs-space-4)",
                      paddingTop: "var(--cs-space-4)",
                      borderTop: "1px solid var(--cs-border)",
                      fontSize: "var(--cs-text-xs)",
                      color: "var(--cs-fg-muted)",
                    }}
                  >
                    {c.proof}
                  </code>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
      </Reveal>

      {/* ===== Honesty boundary: technical vs administrative ===== */}
      <Reveal>
        <Section
          eyebrow="The honesty boundary"
          title="Caisson ships the controls. Your auditor signs the certificate."
          lede="Compliance is trust, so the line is drawn plainly: Caisson covers the technical half and generates the evidence. It does not — and cannot — make you certified."
          band="surface"
        >
          <div
            className="cs-grid cs-grid--2"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            <Card>
              <div className="cs-status">
                <StatusChip
                  label="Caisson ships this"
                  tone="success"
                  icon="check"
                  dot
                />
              </div>
              <ul
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-4)",
                  paddingLeft: "var(--cs-space-5)",
                  lineHeight: "var(--cs-leading-relaxed)",
                }}
              >
                <li>The technical access and integrity controls, in code.</li>
                <li>
                  A dated evidence pack mapped to named SOC 2 / HIPAA controls.
                </li>
                <li>A tamper-evident audit chain you can replay and export.</li>
              </ul>
            </Card>
            <Card>
              <div className="cs-status">
                <StatusChip
                  label="You own this"
                  tone="muted"
                  icon="scale"
                  dot
                />
              </div>
              <ul
                className="cs-muted"
                style={{
                  marginTop: "var(--cs-space-4)",
                  paddingLeft: "var(--cs-space-5)",
                  lineHeight: "var(--cs-leading-relaxed)",
                }}
              >
                <li>
                  Administrative controls — HR, vendor management, incident
                  response.
                </li>
                <li>The audit engagement and the certification itself.</li>
                <li>
                  The scope decision: Caisson ships the controls CC6.x / CC7.2
                  require, not a compliance verdict.
                </li>
              </ul>
            </Card>
          </div>
        </Section>
      </Reveal>

      {/* ===== FAQ (visible + JSON-LD) ===== */}
      <Reveal>
        <Section
          eyebrow="Procurement questions"
          title="What a security review asks first."
        >
          <Faq items={FAQ} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== Pricing ===== */}
      <Reveal>
        <Section
          eyebrow="How Compliance is sold"
          title="Own the source, or track the frameworks."
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
                {compliancePrice ? formatPrice(compliancePrice) : "from $749"}
              </span>
              <span className="cs-tag">One-time license · own the source</span>
            </div>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "58ch" }}
            >
              Own the Compliance edition outright — the base, the five controls,
              and the evidence-pack generator. Regulations don&apos;t hold
              still, so an optional Compliance Updates subscription keeps the
              control mappings current as SOC 2 / HIPAA guidance moves.
            </p>
            <div className="cs-cta-row">
              {editionCartItem && (
                <AddToCartButton item={editionCartItem} variant="primary" />
              )}
              <Button href="/pricing" variant="ghost">
                See the full lineup
              </Button>
            </div>
          </Card>
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Section eyebrow="Get started" title="Start fail-closed.">
        <div style={{ maxWidth: "36rem", marginTop: "var(--cs-space-6)" }}>
          <Terminal
            label="shell"
            status={<StatusChip label="ready" tone="success" dot />}
          >
            {`$ npx create-caisson@latest\n`}
            <span className="cs-tok-accent">{`✓ scaffold complete\n`}</span>
            <span className="cs-tok-accent">{`✓ tenancy-rls: fail-closed\n`}</span>
            <span className="cs-tok-accent">{`✓ standards gate: passing\n`}</span>
          </Terminal>
        </div>
        <div className="cs-cta-row" style={{ marginTop: "var(--cs-space-6)" }}>
          {editionCartItem && (
            <AddToCartButton item={editionCartItem} variant="primary" />
          )}
          <Button href="/docs" variant="ghost">
            Read the docs
          </Button>
        </div>
      </Section>
    </>
  );
}
