import Link from "next/link";
import type { Metadata } from "next";

import { WaitlistForm } from "@/components/waitlist-form";

export const metadata: Metadata = {
  title: "Compliance — fail-closed infrastructure for regulated SaaS",
  description:
    "Fail-closed Postgres RLS with FORCE, S3 Object-Lock WORM, an append-only SHA-256 audit chain, per-tenant field encryption, and a SOC 2 / HIPAA evidence-pack generator — wired and tested before your first audit, not backfilled after it.",
};

// Each guarantee carries its own evidence artifact — a real policy / terminal
// transcript, not a claim. Voice contract (specs/04): show, don't assert.
const GUARANTEES = [
  {
    glyph: "▣",
    label: "Fail-closed RLS",
    title: "Postgres row-level security with FORCE.",
    body: "Every tenant table enables and FORCEs RLS, so the policy binds the table owner too — there is no privileged path around it. A query that never set the tenant context returns nothing, not everything. Cross-tenant isolation is a test in CI, not a convention you hope each developer remembers.",
    evidence: `-- Tenant tables enable AND force RLS — the owner is bound by policy too.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON invoices
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- A query with no tenant context fails closed — it cannot read across tenants.
> SELECT count(*) FROM invoices;     -- app.tenant_id was never set
ERROR:  unrecognized configuration parameter "app.tenant_id"`,
    proves:
      "Maps to SOC 2 CC6.1 (logical access) and HIPAA §164.312(a)(1) (access control).",
  },
  {
    glyph: "▤",
    label: "WORM storage",
    title: "S3 Object-Lock in compliance mode.",
    body: "Evidence buckets ship with Object Lock enabled and a default retention in COMPLIANCE mode. Inside the window an object cannot be overwritten or deleted — not by an application bug, not by an operator, not by a leaked root key. Retention is a property of the storage, not of your good intentions.",
    evidence: `# Evidence buckets enforce Object Lock in COMPLIANCE mode with default retention.
$ aws s3api get-object-lock-configuration --bucket caisson-evidence
{ "ObjectLockConfiguration": { "ObjectLockEnabled": "Enabled",
    "Rule": { "DefaultRetention": { "Mode": "COMPLIANCE", "Years": 7 } } } }

# A delete inside the retention window is refused — for every caller.
$ aws s3api delete-object --bucket caisson-evidence --key audit/2026-q2.jsonl
AccessDenied: object is WORM-protected and cannot be deleted until
2033-06-27T00:00:00Z (COMPLIANCE mode — no override exists).`,
    proves:
      "Maps to HIPAA §164.312(c)(1) (integrity) and SOC 2 CC7.2 (monitoring of stored evidence).",
  },
  {
    glyph: "▥",
    label: "Append-only audit chain",
    title: "Every privileged action hashes into a SHA-256 chain.",
    body: "Each audit row commits SHA-256 over the previous hash plus its own payload. The log is append-only and replayable: tampering with any historical row breaks every link after it, and the break is detectable, provable, and exportable. You can hand an auditor the proof, not a screenshot.",
    evidence: `# Each row = sha256(prev_hash || payload). The chain replays and verifies.
$ caisson audit verify --table audit_log
seq 41982   sha256 9f2c…a1   prev 7be4…0c   ok
seq 41983   sha256 3d80…ee   prev 9f2c…a1   ok
seq 41984   sha256 c5a7…42   prev 3d80…ee   ok
chain intact — 41984 rows, 0 breaks, root 2c9f…b7`,
    proves:
      "Maps to HIPAA §164.312(b) (audit controls) and SOC 2 CC7.2 (detection of unauthorized change).",
  },
];

// Compliance-edition SKU structure only — no numbers (pricing fork open, ADR-0048).
const SKUS = [
  {
    name: "One-time license",
    body: "Own the Compliance edition source outright — the base, the four guarantees, and the evidence-pack generator.",
  },
  {
    name: "Compliance Updates",
    body: "A subscription that tracks framework drift — policy templates and control maps move as SOC 2 / HIPAA guidance does.",
  },
  {
    name: "EU AI Act-ready add-on",
    body: "An Annex IV technical-documentation pack, gated as an add-on and sold worldwide. Not geo-restricted.",
  },
];

export default function CompliancePage() {
  return (
    <>
      {/* ===== Hero ===== */}
      <section className="cs-section cs-section--flush">
        <div className="cs-container">
          <span className="cs-eyebrow">
            Compliance-grade infrastructure for regulated SaaS
          </span>
          <h1
            style={{
              fontSize: "var(--cs-text-display)",
              lineHeight: "var(--cs-leading-tight)",
              letterSpacing: "var(--cs-tracking-tighter)",
              fontWeight: "var(--cs-weight-semibold)",
              margin: "var(--cs-space-5) 0 var(--cs-space-4)",
              maxWidth: "18ch",
            }}
          >
            Audit-ready from the first commit.
          </h1>
          <p className="cs-lede" style={{ maxWidth: "66ch" }}>
            Three controls auditors ask for — tenant isolation, immutable
            evidence, and a tamper-evident log — wired in and tested before your
            first customer. You start fail-closed, then prove it on demand.
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--cs-space-3)",
              marginTop: "var(--cs-space-8)",
              flexWrap: "wrap",
            }}
          >
            <Link href="#waitlist" className="cs-btn cs-btn--primary">
              Request early access
            </Link>
            <Link href="/docs" className="cs-btn cs-btn--ghost">
              Read the docs
            </Link>
          </div>

          {/* The whole pitch in one transcript: deny first, ask questions later. */}
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-12)", maxWidth: "62ch" }}
            aria-label="Example: a query with no tenant context is denied by row-level security"
          >
            {`$ psql -c "select * from invoices"
ERROR:  permission denied for table invoices
DETAIL: RLS policy "tenant_isolation" forbids SELECT
        with no app.tenant_id set — fail-closed by default.`}
          </pre>
        </div>
      </section>

      {/* ===== The three guarantees (deep, each with evidence) ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">The three guarantees</span>
          <h2 className="cs-section-title">
            Prevention at the application layer — with the receipts.
          </h2>
          <p className="cs-lede">
            Each guarantee ships with a live artifact you can read, run, and
            hand to an auditor. No diagrams standing in for behaviour.
          </p>

          <div className="cs-grid" style={{ marginTop: "var(--cs-space-8)" }}>
            {GUARANTEES.map((g) => (
              <article key={g.label} className="cs-card">
                <div className="cs-status">
                  <span className="glyph" aria-hidden="true">
                    {g.glyph}
                  </span>
                  {g.label}
                </div>
                <h3
                  className="cs-card-title"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {g.title}
                </h3>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-3)", maxWidth: "70ch" }}
                >
                  {g.body}
                </p>
                <pre
                  className="cs-code"
                  style={{ marginTop: "var(--cs-space-5)" }}
                  aria-label={`Evidence artifact for ${g.label}`}
                >
                  {g.evidence}
                </pre>
                <p
                  className="cs-footnote"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {g.proves}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Per-tenant field crypto (HKDF) ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">Per-tenant field encryption</span>
          <h2 className="cs-section-title">
            One tenant&apos;s key never decrypts another&apos;s column.
          </h2>
          <p className="cs-lede">
            Sensitive columns are encrypted with a data key derived per tenant
            from a root KMS key via HKDF-SHA256. A leaked tenant key exposes one
            tenant, never the table. Rotating the root re-derives every tenant
            key while ciphertext stays addressable.
          </p>
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-8)", maxWidth: "78ch" }}
            aria-label="Per-tenant data-encryption-key derivation via HKDF-SHA256"
          >
            {`// Per-tenant DEK derived from the root KMS key — scoped by tenant id.
const dek = hkdf("sha256", rootKey, /* salt */ tenantId,
                 /* info */ "caisson/field-v1", 32);

const sealed = aesgcm.seal(dek, plaintext);   // AES-256-GCM, per-field nonce

// A DEK derived for tenant A cannot open tenant B's ciphertext — different
// salt, different key. Root rotation re-derives all DEKs; no re-encrypt scan.`}
          </pre>
        </div>
      </section>

      {/* ===== Evidence-pack generator ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">Evidence-pack generator</span>
          <h2 className="cs-section-title">
            Map a framework to the running system — not a spreadsheet.
          </h2>
          <p className="cs-lede">
            One command collects the live RLS policies, the WORM retention
            config, and an audit-chain proof, then maps them to named controls
            and writes a dated bundle. The evidence comes from the system that
            actually enforces it.
          </p>
          <pre
            className="cs-code"
            style={{ marginTop: "var(--cs-space-8)", maxWidth: "80ch" }}
            aria-label="Generating a SOC 2 evidence pack from the live system"
          >
            {`$ caisson compliance evidence-pack --framework soc2 --period 2026-Q2
collecting   RLS policies (live) · WORM retention · audit-chain proof
mapped 14 controls → CC6.1 access · CC7.2 monitoring · CC8.1 change mgmt
wrote  evidence/soc2-2026-q2.zip
       (controls.json, policies.sql, retention.json, chain-proof.txt)`}
          </pre>

          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-8)" }}>
            EU AI Act Annex IV ships as an EU AI Act-ready add-on — a
            technical-documentation pack sold worldwide, never geo-restricted.
          </p>
        </div>
      </section>

      {/* ===== Retrofit-cost callout (locked line) ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">Why now, not later</span>
          <article
            className="cs-card cs-card--accent"
            style={{ marginTop: "var(--cs-space-4)" }}
          >
            <p
              style={{
                fontSize: "var(--cs-text-xl)",
                lineHeight: "var(--cs-leading-relaxed)",
                letterSpacing: "var(--cs-tracking-tight)",
                maxWidth: "52ch",
              }}
            >
              Retrofitting RLS, WORM storage, and an audit chain into a live
              multi-tenant database costs months. Start with them.
            </p>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "60ch" }}
            >
              Once tenants share rows in production, isolation becomes a
              migration with customer data on the line. Day one, it is a
              default.
            </p>
          </article>
        </div>
      </section>

      {/* ===== SKU structure (Compliance edition only — no prices, ADR-0048) ===== */}
      <section className="cs-section">
        <div className="cs-container">
          <span className="cs-eyebrow">How Compliance is sold</span>
          <h2 className="cs-section-title">Own it, track it, or extend it.</h2>
          <div
            className="cs-grid cs-grid--3"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {SKUS.map((s) => (
              <article key={s.name} className="cs-card">
                <div className="cs-card-title">{s.name}</div>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-2)" }}
                >
                  {s.body}
                </p>
                <p
                  className="cs-status"
                  style={{ marginTop: "var(--cs-space-5)" }}
                >
                  <span className="glyph" aria-hidden="true">
                    ◷
                  </span>
                  Early access — join the waitlist
                </p>
              </article>
            ))}
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            Pricing is set at early access.{" "}
            <Link href="/pricing" style={{ color: "var(--cs-link)" }}>
              See the full lineup
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ===== Waitlist ===== */}
      <section className="cs-section" id="waitlist">
        <div className="cs-container">
          <span className="cs-eyebrow">Early access</span>
          <h2 className="cs-section-title">Start fail-closed.</h2>
          <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
            Join the early-access list. We&apos;ll reach out as the Compliance
            edition opens.
          </p>
          <WaitlistForm source="compliance" />
        </div>
      </section>
    </>
  );
}
