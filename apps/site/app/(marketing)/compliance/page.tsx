import type { ReactNode } from "react";
import Link from "next/link";

import {
  Button,
  Card,
  CredentialStrip,
  Faq,
  FeatureGrid,
  Hero,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
  type IconName,
} from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { editionCatalogItem, toCartItem } from "@/lib/catalog";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { EDITION_MARKS, moduleMark } from "@/lib/marks";
import { editionPrice, formatUsd, MODULE_PRICES } from "@/lib/pricing";
import { TrackView } from "@/components/track-view";

export const metadata = buildMetadata({
  title: "Compliance",
  description:
    "Fail-closed Postgres RLS, S3 Object-Lock WORM, an append-only audit chain, per-tenant field encryption, alerting, and a retention runner — composed into one edition and shipped with a SOC 2 / HIPAA evidence-pack generator. Caisson ships the technical controls and generates the evidence; the certification is your auditor's.",
  path: "/compliance",
});

// Base packages predate the F6 sellable-module mark set (`lib/marks.ts`) — a small local map fills
// the icon for the three that never got a standalone SKU. Sellable members resolve via `moduleMark`.
const BASE_MEMBER_ICON: Record<string, IconName> = {
  kernel: "caisson",
  "tenancy-rls": "rls",
  migrate: "database",
};

// The edition's real composed packages (record: edition-compliance.json memberModules) — icon +
// name + one-liner, priced via a StatusChip when the package is also sold standalone
// (`MODULE_PRICES`), linking to its module depth page; base packages render unpriced.
const MEMBER_MODULES: readonly {
  id: string;
  name: string;
  oneLiner: string;
}[] = [
  {
    id: "kernel",
    name: "Kernel",
    oneLiner:
      "Typed config/schema, the SHA-256 chain primitive, and append-only versioning that the rest of the edition builds on.",
  },
  {
    id: "tenancy-rls",
    name: "Tenancy RLS",
    oneLiner:
      "Fail-closed row-level security — every tenant table enables AND forces RLS, so a query with no tenant context returns nothing.",
  },
  {
    id: "field-crypto",
    name: "Field encryption",
    oneLiner:
      "Per-tenant field encryption via HKDF-SHA256 + AES-256-GCM; a leaked tenant key exposes one tenant, never the table.",
  },
  {
    id: "audit-worm",
    name: "Audit chain + WORM",
    oneLiner:
      "Append-only SHA-256 audit chain plus an S3 Object-Lock WORM adapter — evidence storage tampering breaks the chain and is provable.",
  },
  {
    id: "migrate",
    name: "Migrate",
    oneLiner:
      "The one migration assembler and runner: forward-only, idempotent, and fails closed on checksum drift.",
  },
  {
    id: "alerting",
    name: "Alert pipeline",
    oneLiner:
      "Deduped, rate-capped alert delivery with quiet hours and an audit trail — the SOC 2 CC7.2 alerting control.",
  },
  {
    id: "retention-runner",
    name: "Retention runner",
    oneLiner:
      "Policy-driven data retention on a schedule — expiry and legal-hold, enforced automatically, not by a recurring calendar reminder.",
  },
];

function MemberModuleCard({
  id,
  name,
  oneLiner,
}: {
  id: string;
  name: string;
  oneLiner: string;
}) {
  const price = MODULE_PRICES.find((m) => m.id === id);
  const icon = BASE_MEMBER_ICON[id] ?? moduleMark(id);
  const card = (
    <Card interactive={price !== undefined}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cs-space-3)",
        }}
      >
        <Icon name={icon} size="lg" />
        <span className="cs-card-title">{name}</span>
      </div>
      <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
        {oneLiner}
      </p>
      {price && (
        <div style={{ marginTop: "var(--cs-space-4)" }}>
          <StatusChip label={formatUsd(price.amount)} tone="muted" />
        </div>
      )}
    </Card>
  );
  return price ? (
    <Link
      href={`/marketplace/modules/${id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {card}
    </Link>
  ) : (
    card
  );
}

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

// Visible FAQ (rendered below) — the same items feed the FAQPage JSON-LD (record: edition-compliance.json).
const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: "Does Caisson make us SOC 2 or HIPAA certified?",
    answer:
      "No. Caisson ships the technical controls those frameworks require and generates the evidence to prove them. Certification comes from an auditor assessing your whole program — the organizational controls and the audit itself remain yours.",
  },
  {
    question: "Which packages does the edition actually compose?",
    answer:
      "Seven real workspace dependencies, wired at runtime and re-exported through the edition's own entry point: kernel, tenancy-rls, field-crypto, audit-worm, migrate, alerting, and retention-runner. Nothing on this page is a manifest claim without composed code behind it.",
  },
  {
    question: "Do I own the source?",
    answer:
      "Yes. The one-time Compliance license is perpetual — you own the source for the base, the composed packages, and the evidence-pack generator. An optional Compliance Updates subscription tracks framework drift so the control mappings stay current.",
  },
];

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
      {`DETAIL: RLS policy "tenant_isolation"\n`}
      {`        forbids SELECT with no\n`}
      {`        app.tenant_id set —\n`}
      {`        `}
      <span className="cs-tok-accent">fail-closed by default.</span>
    </Terminal>
  );

  return (
    <>
      <TrackView item="edition:compliance" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            softwareApplication({
              name: "Caisson Compliance",
              description:
                "Fail-closed Postgres RLS, S3 Object-Lock WORM, an append-only audit chain, per-tenant field encryption, alerting, and a retention runner — composed into one edition and shipped with a SOC 2 / HIPAA evidence-pack generator. Caisson ships the technical controls and generates the evidence; the certification is your auditor's.",
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
        lede="Compliance composes seven packages into one edition: tenant isolation that fails closed, evidence that can't be overwritten, and a tamper-evident log that proves it. Own the source, wire it in before your first customer, and hand an auditor an artifact instead of a slide deck."
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

      {/* ===== What it composes ===== */}
      <Reveal>
        <Section
          eyebrow="What it composes"
          lede="The Compliance edition is a real runtime composition of seven @caisson/* packages, not a bundle of marketing copy: kernel (typed config, the SHA-256 chain primitive, append-only versioning), tenancy-rls (the fail-closed RLS guard), field-crypto (per-tenant HKDF-SHA256 + AES-256-GCM field encryption), audit-worm (the append-only audit chain plus the S3 Object-Lock WORM adapter), migrate (the one migration assembler and runner, forward-only and checksum-drift-safe), and alerting plus retention-runner (deduped alert delivery and policy-driven data retention). alerting and retention-runner are wired in as real workspace dependencies and re-exported through the edition's own index, not asserted in a manifest and left uncomposed."
        />
      </Reveal>

      {/* ===== Media slot (ADR-0237 F2) ===== */}
      <Section>
        <MediaPlaceholder icon={EDITION_MARKS.compliance} />
      </Section>

      {/* ===== The seven composed packages ===== */}
      <Reveal>
        <Section
          eyebrow="The composition"
          title="Seven packages, one edition."
          lede="Each member is a real workspace dependency — not a manifest claim. The ones also sold standalone carry their own price."
        >
          <FeatureGrid cols={3}>
            {MEMBER_MODULES.map((m) => (
              <MemberModuleCard key={m.id} {...m} />
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Who it's for ===== */}
      <Reveal>
        <Section
          eyebrow="Who it's for"
          title="Teams that need the controls before the first customer, not after."
          lede="Teams building regulated SaaS — HIPAA, SOC 2, or both — who need the technical access and integrity controls in place before the first customer shares a row, not backfilled after a pen test or a procurement questionnaire flags the gap. Retrofitting RLS, WORM, and an audit chain into a live multi-tenant database is a migration with customer data on the line; wiring them in on day one is a schema decision."
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
          lede="Caisson ships the technical controls SOC 2 CC6.x / CC7.2 and HIPAA §164.312 require, and generates the dated evidence bundle mapped to those named controls. It does not — and cannot — make you certified: the administrative controls (HR, vendor management, incident response) and the audit engagement itself stay with you and your auditor."
          band="surface"
        >
          <FeatureGrid cols={2}>
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
          </FeatureGrid>
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

      {/* ===== Pricing / how it ships ===== */}
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
                {editionPrice("compliance")}
              </span>
              <span className="cs-tag">One-time license · own the source</span>
              <StatusChip label="Edition" tone="muted" />
            </div>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "60ch" }}
            >
              A one-time, perpetual license: bun create caisson@latest scaffolds
              the base with tenancy-rls fail-closed and the standards gate
              passing, and the five evidence collectors — RLS-force,
              chain-verify, WORM-retention, field-crypto-policy, and the
              impersonation collector — are already wired into the SOC 2, HIPAA,
              and EU-AI-Act evidence packs. The pack format includes an OSCAL
              v1.2.2 export (canonical JSON plus an XML conversion path)
              alongside Ed25519 and RFC-3161 signing.{" "}
              <code className="mono">caisson audit verify</code> walks the chain
              and reports the root hash; the evidence pack is generated from the
              live system, not written by hand.
            </p>
            <div className="cs-cta-row">
              {editionCartItem && (
                <AddToCartButton item={editionCartItem} variant="primary" />
              )}
              <Button href="/marketplace" variant="ghost">
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
            {`$ bun create caisson@latest\n`}
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
