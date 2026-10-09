// EU AI Act-ready framework page (ADR-0040 §3, ADR-0079 §2, ADR-0080 §3).
// Honest framing: Caisson GENERATES the technical evidence Annex IV requires.
// Whether a system meets EU AI Act obligations is a legal determination — not
// something a codebase starter can certify. Never claim compliance.
import {
  Button,
  Card,
  CodeBlock,
  CredentialStrip,
  Hero,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
} from "@/components";
import {
  ARTICLE_50_SUMMARY_SOURCES,
  ARTICLE_50_VERIFIED_ON,
} from "@/lib/article-50-sources";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import { breadcrumb, serializeJsonLd, techArticle } from "@/lib/jsonld";

export const metadata = buildMetadata({
  title: "EU AI Act-ready",
  description:
    "Caisson generates the logging, traceability, and data-governance artifacts an EU AI Act Annex IV technical-documentation file requires: audit chain, RLS + field-crypto, eval harness, and human-oversight hooks, all wired and testable before your first assessment.",
  path: "/frameworks/eu-ai-act",
  type: "article",
});

// Annex IV / Article → Caisson control mapping.
// Honest scope: "produces the technical evidence" — never "makes you compliant".
//
// Import paths in the `evidence` snippets below track the version npm SERVES.
// Flipped to "@caisson-sh/kernel/node" in the same commit the kernel 0.7.0 minor is tagged from:
// verifyChain moved off the "." barrel in that release, so against 0.7.0 the old path raises
// "does not provide an export named 'verifyChain'". Flip per SYMBOL, not per block — canonicalize,
// scrubDeep, scrubForEgress, looksLikeSecret, and assertNotReadOnly all stay on ".".
const ANNEX_CONTROLS = [
  {
    icon: "audit-chain" as const,
    article: "Article 12 · Annex IV §3",
    label: "Record-keeping",
    title: "Every inference hashes into an append-only chain.",
    body: "Article 12 requires high-risk AI systems to log events at a level sufficient to trace decisions back through time. Caisson's audit chain writes each event with SHA-256 over the previous hash, so tamper, truncation, and reorder each break the chain and surface on verify. What you hand an auditor is that same chain, run live.",
    evidence: `// kernel verifyChain — append-only SHA-256 audit chain
import { verifyChain } from "@caisson-sh/kernel/node";

const result = await verifyChain(db, { table: "ai_inference_log" });
// { intact: true, rows: 7043, breaks: 0, root: "9c3a…f1" }

// A tampered row breaks every subsequent link — detectable and provable.
// The chain is tested in CI on every push (RLS cross-tenant test suite).`,
    clause: "Art. 12(1) · Annex IV §3 (logging of operation period)",
  },
  {
    icon: "rls" as const,
    article: "Article 10 · Annex IV §2(f)",
    label: "Data governance",
    title: "Training and inference data isolated per tenant by construction.",
    body: "Article 10 requires data-governance practices covering the datasets used to train and operate the system. Fail-closed Postgres RLS ensures no query crosses a tenant boundary without an explicit, policy-enforced grant. A query that never sets the tenant context returns nothing, enforced by the database's own privilege system rather than a checklist an engineer might skip.",
    evidence: `-- RLS forces every query through the data-governance policy.
ALTER TABLE ai_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_training_records FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_data_scope ON ai_training_records
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Cross-tenant access attempt fails closed — no privileged path.
> SELECT count(*) FROM ai_training_records;  -- no tenant context set
ERROR:  unrecognized configuration parameter "app.tenant_id"`,
    clause: "Art. 10(2) · Annex IV §2(f) (data governance measures)",
  },
  {
    icon: "field-crypto" as const,
    article: "Article 10 · Annex IV §2(f)",
    label: "Field-level encryption",
    title: "Sensitive training data encrypted per tenant at the column level.",
    body: "Where Article 10 data-governance requirements apply to personally identifiable training data, Caisson encrypts sensitive columns with a key derived per tenant via HKDF-SHA256. A leaked key exposes one tenant's data, not the table. Root key rotation re-derives every tenant key without a re-encrypt scan.",
    evidence: `// Per-tenant DEK scoped by tenant id — one leaked key, one tenant.
const dek = hkdf("sha256", rootKey, /* salt */ tenantId,
                 /* info */ "caisson/field-v1", 32);

const sealed = aesgcm.seal(dek, sensitiveTrainingField);

// Tenant A's DEK cannot open tenant B's ciphertext — structurally.
// Root rotation re-derives; ciphertext stays addressable.`,
    clause:
      "Art. 10(5) · Annex IV §2(f) (appropriate security measures for data)",
  },
  {
    icon: "gauge" as const,
    article: "Article 9 · Annex IV §5",
    label: "Accuracy and robustness testing",
    title: "Eval harness gates every pull request against a golden set.",
    body: "Article 9 risk-management and Annex IV §5 require documented testing for accuracy, robustness, and cybersecurity. Caisson's standalone eval-harness module (ai-evals) ships a golden-file eval harness that gates pull requests on score regression past a declared tolerance, checked into the repo as caisson.ai.toml and enforced the same way on every push.",
    evidence: `# caisson.ai.toml — eval gate configuration (ai-evals module)
# Wires CI to fail the PR when accuracy drops past the declared tolerance.
# The golden set, baseline, and report are repo artifacts an assessor can read.
[evals]
gate       = "ci"      # fail the PR on score drop
tolerance  = 0.02      # max allowed regression before block
golden_set = "evals/annex-iv-accuracy.jsonl"
report_dir = "reports/"`,
    clause:
      "Art. 9(4)(b) · Annex IV §5 (testing procedures + performance metrics)",
  },
  {
    icon: "fail-closed" as const,
    article: "Article 14 · Annex IV §4",
    label: "Human oversight hooks",
    title:
      "Circuit breaker and spend cap surface override control to operators.",
    body: "Article 14 requires high-risk AI systems to allow natural persons to intervene and override automated outputs. Caisson's circuit breaker opens when a tenant's token spend exceeds a hard cap, returning HTTP 402 and surfacing the event: a structural pause that routes control back to the operator before the next call. Override and reset are explicit, logged operator actions inside the same audit chain the rest of the system writes to.",
    evidence: `// billing primitives (base substrate) — hard spend cap per tenant
import { checkCredits, recordUsage } from "@caisson-sh/billing";

const ok = await checkCredits(db, { tenantId, tokens: estimatedTokens });
if (!ok) {
  // HTTP 402 surfaces the pause — override is an explicit operator action
  return Response.json({ error: "token_cap_exceeded" }, { status: 402 });
}
// Override and resume are explicit actions, logged to the audit chain.
// No automatic resumption — the structural pause routes control back to the operator.`,
    clause: "Art. 14(1)(3) · Annex IV §4 (human oversight measures)",
  },
] as const;

// Base-substrate terminal artifact for the hero right half.
// Shows real controls from the built substrate: RLS denial + verifyChain.
function EuAiActTerminal() {
  return (
    <Terminal
      label="base substrate · RLS + audit chain"
      status={<StatusChip label="CI-tested" tone="success" dot />}
    >
      {`-- RLS cross-tenant denial\n`}
      {`-- (Art. 10 data governance)\n`}
      {`> SELECT count(*)\n`}
      {`  FROM ai_inference_log;\n`}
      {`  -- no tenant context set\n`}
      <span className="cs-tok-accent">
        {`ERROR:  unrecognized config\n`}
        {`  parameter "app.tenant_id"\n`}
      </span>
      {`\n`}
      {`// kernel verifyChain\n`}
      {`  (Art. 12 record-keeping)\n`}
      {`const result = await\n`}
      {`  verifyChain(db, {\n`}
      {`  table: "ai_inference_log"\n`}
      {`});\n`}
      {`// `}
      <span className="cs-tok-success">
        {`{ intact: true,\n`}
        {`  rows: 7043, breaks: 0 }`}
      </span>
    </Terminal>
  );
}

// JSON-LD: TechArticle + BreadcrumbList.
const articleLd = techArticle({
  headline: "EU AI Act-ready technical documentation with Caisson",
  description:
    "Map EU AI Act Annex IV requirements to Caisson controls: audit chain, RLS, field-crypto, eval harness, and human-oversight hooks.",
  url: `${SITE_URL}/frameworks/eu-ai-act`,
});
const breadcrumbLd = breadcrumb([
  { name: "Home", path: "/" },
  { name: "Frameworks", path: "/frameworks" },
  { name: "EU AI Act", path: "/frameworks/eu-ai-act" },
]);

export default function EuAiActPage() {
  return (
    <>
      {/* Structured data: TechArticle + BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbLd) }}
      />

      {/* ===== Hero ===== */}
      <Hero
        eyebrow="Framework · EU AI Act"
        title="Technical evidence for Annex IV."
        lede={
          <>
            Caisson generates the logging, traceability, and data-governance
            artifacts an EU AI Act Annex IV technical-documentation file
            requires. The administrative and legal compliance determination
            stays yours.
          </>
        }
        ctas={
          <>
            <Button href="/marketplace" variant="primary">
              Get Compliance
            </Button>
            <Button href="/docs" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={
          <CredentialStrip
            items={["Annex IV §2–6", "Art. 10", "Art. 12", "Art. 14"]}
            note="Evidence artifacts, no certification or legal opinion implied"
          />
        }
        artifact={<EuAiActTerminal />}
      />

      {/* ===== Honesty boundary (ADR-0080 §3 — non-negotiable) ===== */}
      <Section eyebrow="What this is, and isn't" band="tint">
        <Card accent>
          {/* cs-grid--2 (not an inline 1fr 1fr) so this collapses to one column below the
              48rem rung, matching the same honesty-boundary card on build-vs-buy (id
              3ed806fbf8b1065f). */}
          <div
            className="cs-grid cs-grid--2"
            style={{ gap: "var(--cs-space-6)" }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--cs-font-mono)",
                  fontSize: "var(--cs-text-sm)",
                  color: "var(--cs-accent)",
                  marginBottom: "var(--cs-space-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                What Caisson does
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--cs-space-2)",
                }}
              >
                {[
                  "Generates the technical evidence Annex IV §2–6 requests",
                  "Ships the controls Art. 10 / 12 / 14 require at the code level",
                  "Produces a dated, replayable, auditor-readable artifact bundle",
                  "Wires the gates before your first deployment, not after your first assessment",
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      display: "flex",
                      gap: "var(--cs-space-2)",
                      alignItems: "flex-start",
                      color: "var(--cs-fg)",
                      fontSize: "var(--cs-text-sm)",
                    }}
                  >
                    <Icon name="check" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--cs-font-mono)",
                  fontSize: "var(--cs-text-sm)",
                  color: "var(--cs-fg-muted)",
                  marginBottom: "var(--cs-space-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                What stays yours
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--cs-space-2)",
                }}
              >
                {[
                  "The conformity assessment and legal sign-off",
                  "Risk classification (prohibited / high-risk / limited-risk)",
                  "Organizational controls: HR, vendor management, incident response",
                  "Registration in the EU AI Act database (Art. 49, where required)",
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      display: "flex",
                      gap: "var(--cs-space-2)",
                      alignItems: "flex-start",
                      color: "var(--cs-fg-muted)",
                      fontSize: "var(--cs-text-sm)",
                    }}
                  >
                    <Icon name="arrow" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
        <p className="cs-footnote" style={{ marginTop: "var(--cs-space-4)" }}>
          Caisson ships technical controls. Whether your system satisfies every
          EU AI Act obligation depends on deployment context, risk category, and
          your conformity assessment: that determination belongs to your legal
          team.
        </p>
      </Section>

      {/* ===== Annex IV control map ===== */}
      <Section
        eyebrow="Annex IV control map"
        title="Five requirements. Five controls. All testable."
        lede="Each requirement below maps to a Caisson primitive that produces a verifiable artifact. The output is code you can read, run, and hand to a notified body or an internal assessor."
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--cs-space-6)",
            marginTop: "var(--cs-space-8)",
          }}
        >
          {ANNEX_CONTROLS.map((ctrl) => (
            <Reveal key={ctrl.label}>
              <Card>
                <div
                  style={{
                    display: "flex",
                    // Wrap on narrow viewports — the article + label chips are nowrap pills
                    // (`.cs-chip`), and a single non-wrapping row of them was the audit's 570px
                    // horizontal overflow at a 390px viewport.
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "var(--cs-space-3)",
                    marginBottom: "var(--cs-space-4)",
                  }}
                >
                  <Icon name={ctrl.icon} size="lg" aria-hidden />
                  <div>
                    <StatusChip label={ctrl.article} tone="muted" />
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <StatusChip label={ctrl.label} tone="accent" />
                  </div>
                </div>
                <h3
                  className="cs-card-title"
                  style={{ marginBottom: "var(--cs-space-3)" }}
                >
                  {ctrl.title}
                </h3>
                <p
                  className="cs-muted"
                  style={{
                    maxWidth: "72ch",
                    marginBottom: "var(--cs-space-5)",
                  }}
                >
                  {ctrl.body}
                </p>
                <CodeBlock
                  code={ctrl.evidence}
                  label={`Evidence artifact: ${ctrl.label}`}
                  frame
                  status={<StatusChip label="artifact" tone="muted" />}
                />
                <p
                  className="cs-footnote"
                  style={{ marginTop: "var(--cs-space-3)" }}
                >
                  {ctrl.clause}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ===== Evidence bundle (Compliance module family) ===== */}
      <Reveal>
        <Section
          eyebrow="Evidence artifacts"
          title="Auditor-readable output from live controls."
          lede="The Compliance module family collects the RLS policies, audit-chain proof, and field-encryption config from the system that enforces them, maps each to an Annex IV section, and packages them as a dated, replayable bundle."
          band="surface"
        >
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <CodeBlock
              label="annex-iv-control-map.json: illustrative artifact structure"
              frame
              status={<StatusChip label="Annex IV" tone="accent" dot />}
              code={`{
  "framework": "eu-ai-act",
  "generated": "2026-06-27",
  "controls": [
    { "article": "Art. 12 · Annex IV §3",  "control": "audit-chain",  "status": "verified" },
    { "article": "Art. 10 · Annex IV §2f", "control": "rls-policy",   "status": "active"   },
    { "article": "Art. 10 · Annex IV §2f", "control": "field-crypto", "status": "active"   },
    { "article": "Art. 14 · Annex IV §4",  "control": "spend-cap",    "status": "configured"}
  ],
  "artifacts": [
    "chain-proof.txt",
    "rls-policies.sql",
    "field-crypto-config.json",
    "annex-iv-control-map.json"
  ]
}`}
            />
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-5)" }}>
            The EU AI Act-ready evidence bundle ships with the Compliance module
            family, available to anyone.
          </p>
        </Section>
      </Reveal>

      {/* ===== Why wired before the assessment ===== */}
      <Reveal>
        <Section eyebrow="Why now">
          <Card accent>
            <p
              style={{
                fontSize: "var(--cs-text-xl)",
                lineHeight: "var(--cs-leading-relaxed)",
                letterSpacing: "var(--cs-tracking-tight)",
                maxWidth: "54ch",
              }}
            >
              Retrofitting a tamper-evident log and per-tenant data isolation
              into a live AI system costs months. Start with them.
            </p>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "60ch" }}
            >
              Once inference data and audit events are commingled in production,
              isolating them for Annex IV becomes a migration. On day one, it is
              a default. The controls are structural, tested in CI before your
              first customer signs, well ahead of your first notified-body
              assessment.
            </p>
          </Card>
        </Section>
      </Reveal>

      {/* ===== Article 50 application date (evergreen summary) ===== */}
      <Reveal>
        <Section
          eyebrow="Article 50 · transparency"
          title="Article 50 applies from August 2, 2026."
          band="tint"
        >
          <p className="cs-lede" style={{ maxWidth: "72ch" }}>
            Article 50 generally applies from August 2, 2026. The duties are not
            limited to high-risk systems: providers must disclose covered direct
            AI interaction, while providers of covered generative systems must
            make synthetic outputs machine-readably marked and detectable,
            subject to the provision&rsquo;s exceptions. The adopted Digital
            Omnibus text awaits Official Journal publication and entry into
            force. Once effective, it gives providers of generative AI systems
            placed on the market before August 2 until December 2, 2026 to
            conform with Article 50(2)&rsquo;s marking and detection duty. The
            other Article 50 duties were not postponed.
          </p>
          <p
            className="cs-muted"
            style={{ marginTop: "var(--cs-space-4)", maxWidth: "72ch" }}
          >
            The disclosure surface itself is your product&rsquo;s UI. What
            Caisson supplies is the evidence discipline behind it: disclosure
            events logged to the tamper-evident audit chain, configuration
            versioned in your repo, and a dated evidence bundle that preserves
            evidence that a disclosure event was recorded. Whether the product
            surface satisfies Article 50 remains a separate legal determination.
          </p>
          <p
            className="cs-muted"
            style={{ marginTop: "var(--cs-space-4)", maxWidth: "72ch" }}
          >
            Article 50(2) outputs and Article 50(4) deepfakes generated or
            manipulated before August 2, 2026 do not require retroactive marking
            or labelling. Public-interest text receives that treatment only when
            it was both generated or manipulated and published before August 2.
          </p>
          <p
            className="cs-footnote"
            style={{ marginTop: "var(--cs-space-4)", maxWidth: "72ch" }}
          >
            Primary sources reviewed {ARTICLE_50_VERIFIED_ON}:{" "}
            {ARTICLE_50_SUMMARY_SOURCES.map((source, index) => (
              <span key={source.url}>
                {index > 0 && (
                  <>
                    <br />
                  </>
                )}
                <a className="cs-link" href={source.url} rel="noreferrer">
                  {source.label}
                </a>{" "}
                — {source.locator}
              </span>
            ))}
          </p>
          <div
            className="cs-cta-row"
            style={{ marginTop: "var(--cs-space-6)" }}
          >
            <Button href="/frameworks/eu-ai-act/article-50" variant="ghost">
              What Article 50 requires, in detail
            </Button>
            <Button
              href="/writing/eu-ai-act-article-50-august-december-2026"
              variant="ghost"
            >
              What the July 2026 guidance settled
            </Button>
          </div>
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Section eyebrow="Get started" id="get-started">
        <h2 className="cs-section-title">
          Ship with the evidence already in the repo.
        </h2>
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          The Compliance module family ships the audit chain, RLS policies, and
          field-encryption wired and testable from day one, ready well before
          your first notified-body assessment.
        </p>
        <div style={{ marginBottom: "var(--cs-space-5)" }}>
          <Terminal label="scaffold a Caisson project">
            bunx --package @caisson-sh/cli create-caisson
          </Terminal>
        </div>
        <div className="cs-cta-row">
          <Button href="/marketplace" variant="primary">
            Get Compliance
          </Button>
          <Button href="/docs" variant="ghost">
            Read the docs
          </Button>
        </div>
      </Section>
    </>
  );
}
