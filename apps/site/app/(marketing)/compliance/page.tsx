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
import { TrialPath } from "@/components/trial-path";
import { MediaCarousel } from "@/components/media-carousel";
import { mediaSlides } from "@/lib/media-manifest";
import { requireBundlePage } from "@/lib/bundle-pages";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { moduleMark } from "@/lib/marks";
import { hasModulePage } from "@/lib/module-pages";

// Hero copy, member list, and FAQ read from the shared bundle content record (lib/bundle-pages.ts),
// the SOT this page shares with the marketplace pop-out. Bespoke sections below (the controls,
// honesty boundary, terminals) stay page-local — page-unique, not pop-out-reused.
const record = requireBundlePage("compliance");

export const metadata = buildMetadata({
  title: record.metaTitle,
  description: record.metaDescription,
  path: "/compliance",
});

// Base packages predate the F6 sellable-module mark set (`lib/marks.ts`) — a small local map fills
// the icon for the three that never got a standalone SKU. Sellable members resolve via `moduleMark`.
const BASE_MEMBER_ICON: Record<string, IconName> = {
  kernel: "caisson",
  "tenancy-rls": "rls",
  migrate: "database",
};

// The bundle's real composed packages — read from the shared bundle content record, linking to a
// member's module depth page when one exists.
const MEMBER_MODULES = record.members;

function MemberModuleCard({
  id,
  name,
  oneLiner,
}: {
  id: string;
  name: string;
  oneLiner: string;
}) {
  // Linkable is gated on the depth page actually existing — a Link to a missing one 404s (G5).
  const linkable = hasModulePage(id);
  const icon = BASE_MEMBER_ICON[id] ?? moduleMark(id);
  const card = (
    <Card interactive={linkable}>
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
    </Card>
  );
  return linkable ? (
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
    body: "Every tenant table enables AND forces row-level security, so the policy binds the owner too, no privileged path around it. A query that never set the tenant context returns nothing, not everything.",
    tags: ["SOC 2 CC6.1", "HIPAA §164.312(a)(1)"],
    proof: "SELECT count(*) FROM invoices;  →  ERROR: app.tenant_id not set",
  },
  {
    icon: "worm",
    title: "WORM evidence storage",
    body: "Evidence buckets ship with S3 Object Lock in GOVERNANCE mode and a default retention, with a typed, recorded escalation to COMPLIANCE mode when you choose it. Inside the window an object cannot be overwritten or deleted through any normal path, not by a bug, not by an ordinary operator. In GOVERNANCE mode only a principal holding the bypass-governance permission can remove it; COMPLIANCE mode removes that path too.",
    tags: ["HIPAA §164.312(c)(1)", "SOC 2 CC7.2"],
    proof: "delete-object  →  AccessDenied: WORM-protected until 2033-06-27Z",
  },
  {
    icon: "audit-chain",
    title: "Append-only audit chain",
    body: "Each audit row commits SHA-256 over the previous hash plus its own payload. Tampering with any historical row breaks every link after it, and the break is detectable, provable, and exportable for an auditor.",
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
    body: "Collects the live RLS policies, the WORM retention config, and an audit-chain proof, maps them to named controls, and writes a dated bundle. The evidence comes from the system that enforces it, not a spreadsheet.",
    tags: ["SOC 2 · HIPAA mapping"],
    proof:
      "soc2-evidence-2026-06-28/: rls-policies.json · worm-retention.json · audit-chain-proof.json",
  },
];

// Visible FAQ (rendered below) — the same items feed the FAQPage JSON-LD; read from the record.
const FAQ = record.faq;

// The gallery viewer for this bundle: its live demo, docs, and members in one place.
const GALLERY_HREF = "/marketplace?view=bundle:compliance";

export default function CompliancePage() {
  const heroArtifact: ReactNode = (
    <Terminal
      label="psql, tenant isolation"
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(
            softwareApplication({
              name: "Caisson Compliance",
              description: record.metaDescription,
              url: `${SITE_URL}/compliance`,
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
      {/* data-vt-hero: Door Morph landing pad (ADR-0334 moment 3), the home compliance door
          chip morphs into this hero's eyebrow; global.css assigns the view-transition-name. */}
      <div data-vt-hero="door-compliance">
        <Hero
          eyebrow={record.hero.eyebrow}
          title={record.hero.title}
          lede={record.hero.lede}
          ctas={
            <>
              <Button href={GALLERY_HREF} variant="primary">
                Run the live demo
              </Button>
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
                "PCI DSS · GDPR crosswalks",
                "WORM evidence",
                "Append-only audit",
              ]}
              note="Caisson generates the evidence, the certification is your auditor's call, not ours."
            />
          }
          artifact={heroArtifact}
        />
      </div>

      {/* ===== What it composes ===== */}
      <Reveal>
        <Section
          title="What it composes"
          lede="The Compliance module family's core has ten direct @caisson-sh/* dependencies: kernel, tenancy-rls, field-crypto, audit-worm, migrate, alerting, retention-runner, compliance-core, frameworks-pack, and signing-primitive. compliance-core and frameworks-pack both depend on and re-export oscal-spine, the shared package that owns OSCAL assessment, catalog, XML, ISO 27001 SoA, and pinned NIST SP 800-53 surfaces. The module family also includes three standalone compliance modules beside that runtime graph: access-review, risk-register, and trust-page."
        />
      </Reveal>

      {/* ===== Media slot (ADR-0237 F2) ===== */}
      <Section>
        <MediaCarousel
          slides={mediaSlides("bundle", "compliance")}
          label="Compliance module family media"
        />
      </Section>

      {/* ===== The fourteen member packages ===== */}
      <Reveal>
        <Section
          title="Fourteen packages, one module family."
          lede="Ten direct dependencies plus their shared OSCAL spine form the runtime graph. Three further standalone compliance modules round it out."
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
          title="Teams that need the controls before the first customer, not after."
          lede="Teams building regulated SaaS (HIPAA, SOC 2, or both) who need the technical access and integrity controls in place before the first customer shares a row, not backfilled after a pen test or a procurement questionnaire flags the gap. Retrofitting RLS, WORM, and an audit chain into a live multi-tenant database is a migration with customer data on the line; wiring them in on day one is a schema decision."
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
              SOC 2 from scratch runs <span className="cs-num">6–9 months</span>
              . Retrofitting RLS, WORM, and an audit chain into a <em>live</em>{" "}
              multi-tenant database is months more, a migration with customer
              data on the line.
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
          {/* CAISSON-99: the retrofit-cost card's reactive sibling, the unplanned crisis-sprint
              cost. Scene drawn from the interviewed leads' own accounts (Cookiy 45-transcript
              compliance buying-journey study); interview-attributed, never a case study
              (ADR-0319 R5, no customer stories until design-partner conversions exist). */}
          <Card style={{ marginTop: "var(--cs-space-5)" }}>
            <p
              style={{
                fontSize: "var(--cs-text-lg)",
                lineHeight: "var(--cs-leading-relaxed)",
                letterSpacing: "var(--cs-tracking-tight)",
                maxWidth: "60ch",
              }}
            >
              The unplanned version of that bill: across our interviews,
              prospect and partner reviews kept triggering the same reactive
              sprint. One engineering lead&rsquo;s week, an enterprise prospect
              asks for a 90-day audit export, the logs are missing admin
              actions, and the roadmap loses a{" "}
              <span className="cs-num">war-room week</span> with the deal on the
              line.
            </p>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "60ch" }}
            >
              Those reviews ask for what this module family ships, the audit
              chain, immutable logs, the evidence export. Install the controls
              before the deal that demands them.
            </p>
          </Card>
        </Section>
      </Reveal>

      {/* ===== The five controls (evidence cards) ===== */}
      <Reveal>
        <Section
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
          title="Caisson ships the controls. Your auditor signs the certificate."
          lede="Caisson ships the technical controls SOC 2 CC6.x / CC7.2 and HIPAA §164.312 require, and generates the dated evidence bundle mapped to those named controls. It does not (and cannot) make you certified: the administrative controls (HR, vendor management, incident response) and the audit engagement itself stay with you and your auditor."
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
                  Administrative controls, HR, vendor management, incident
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
          <p
            className="cs-muted"
            style={{ marginTop: "var(--cs-space-6)", maxWidth: "72ch" }}
          >
            Why the ownership line matters: in March 2026 a venture-backed
            compliance-automation vendor was publicly accused of delivering
            AI-fabricated SOC 2 reports to hundreds of customers (TechCrunch,
            2026-03-22). Whatever that case resolves to, the lesson stands:
            evidence you cannot verify independently is a promise, not proof.
            Caisson&rsquo;s audit chain is hash-linked and anchored write-once
            outside your database, and its evidence packs are deterministic to
            the byte, so your auditor verifies integrity without trusting any
            vendor, including us.
          </p>
        </Section>
      </Reveal>

      {/* ===== How it's proven: the real CI conformance gate + precise scope ===== */}
      <Reveal>
        <Section
          title="The evidence format is schema-checked in CI, on every push."
          lede="Not a claim you take on trust: every push runs an OSCAL conformance gate. The evidence pack is exported to NIST OSCAL v1.2.2 and round-tripped JSON → XML → schema-validate against the published OSCAL schema, so a malformed or drifted export fails the build before it ships."
          band="tint"
        >
          <Card>
            <div className="cs-status">
              <StatusChip
                label="oscal-conformance · required check"
                tone="success"
                icon="check"
                dot
              />
            </div>
            <code
              className="mono"
              style={{
                display: "block",
                marginTop: "var(--cs-space-4)",
                fontSize: "var(--cs-text-xs)",
                color: "var(--cs-fg-muted)",
              }}
            >
              oscal-cli validate soc2-evidence.xml → SAR + POA&amp;M · v1.2.2 ·
              schema OK
            </code>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "72ch" }}
            >
              Precise scope: this gate proves the evidence pack conforms to the
              NIST OSCAL schema (structure and well-formedness) so the export is
              machine-readable by any tool that speaks OSCAL. It is a self-run
              conformance check on Caisson&rsquo;s own export format, not a
              third-party assessment. No external body assesses or certifies
              Caisson or your deployment; that engagement stays with your
              auditor.
            </p>
          </Card>
        </Section>
      </Reveal>

      {/* ===== FAQ (visible + JSON-LD) ===== */}
      <Reveal>
        <Section title="What a security review asks first.">
          <Faq items={FAQ} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== How it ships ===== */}
      <Reveal>
        <Section title="How it ships." band="tint">
          <Card accent className="cs-elevate-md">
            <p className="cs-muted" style={{ maxWidth: "60ch" }}>
              bunx --package @caisson-sh/cli create-caisson scaffolds the base
              with tenancy-rls fail-closed and the standards gate passing, and
              the five evidence collectors, RLS-force, chain-verify,
              WORM-retention, field-crypto-policy, and the impersonation
              collector, are already wired into the SOC 2, HIPAA, and EU-AI-Act
              evidence packs. The pack format includes an OSCAL v1.2.2 export
              (canonical JSON plus an XML conversion path) alongside Ed25519 and
              RFC-3161 signing.{" "}
              <code className="mono">caisson audit verify</code> walks the chain
              and reports the root hash; the evidence pack is generated from the
              live system, not written by hand.
            </p>
            <div className="cs-cta-row">
              <Button href={GALLERY_HREF} variant="primary">
                Run the live demo
              </Button>
              <Button href="/marketplace" variant="ghost">
                See the full lineup
              </Button>
            </div>
          </Card>
        </Section>
      </Reveal>

      {/* ===== Prove fit in week one (ADR-0272 §3) ===== */}
      <Reveal>
        <Section
          title="Prove fit in week one."
          lede="Don't take the fit on faith, scaffold the audited base and run it on your own stack."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <TrialPath />
          </div>
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Section title="Start fail-closed.">
        <div style={{ maxWidth: "36rem", marginTop: "var(--cs-space-6)" }}>
          <Terminal
            label="shell"
            status={<StatusChip label="ready" tone="success" dot />}
          >
            {`$ bunx --package @caisson-sh/cli create-caisson\n`}
            <span className="cs-tok-accent">{`✓ scaffold complete\n`}</span>
            <span className="cs-tok-accent">{`✓ tenancy-rls: fail-closed\n`}</span>
            <span className="cs-tok-accent">{`✓ standards gate: passing\n`}</span>
          </Terminal>
        </div>
        <div className="cs-cta-row" style={{ marginTop: "var(--cs-space-6)" }}>
          <Button href={GALLERY_HREF} variant="primary">
            Run the live demo
          </Button>
          <Button href="/docs" variant="ghost">
            Read the docs
          </Button>
        </div>
      </Section>
    </>
  );
}
