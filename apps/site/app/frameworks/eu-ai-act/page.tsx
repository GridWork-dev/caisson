// EU AI Act-ready framework page (ADR-0040 §3, ADR-0079 §2, ADR-0080 §3).
// Honest framing: Caisson GENERATES the technical evidence Annex IV requires.
// Whether a system meets EU AI Act obligations is a legal determination — not
// something a codebase starter can certify. Never claim compliance.
import { WaitlistForm } from "@/components/waitlist-form";
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
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import { breadcrumb, serializeJsonLd, techArticle } from "@/lib/jsonld";

export const metadata = buildMetadata({
  title: "EU AI Act-ready",
  description:
    "Caisson generates the logging, traceability, and data-governance artifacts an EU AI Act Annex IV technical-documentation file requires — audit chain, RLS + field-crypto, eval harness, and human-oversight hooks, all wired and testable before your first assessment.",
  path: "/frameworks/eu-ai-act",
  type: "article",
});

// Annex IV / Article → Caisson control mapping.
// Honest scope: "produces the technical evidence" — never "makes you compliant".
const ANNEX_CONTROLS = [
  {
    icon: "audit-chain" as const,
    article: "Article 12 · Annex IV §3",
    label: "Record-keeping",
    title: "Every inference hashes into an append-only chain.",
    body: "Article 12 requires high-risk AI systems to log events at a level sufficient to trace decisions back through time. Caisson's audit chain writes each event with SHA-256 over the previous hash — the log is append-only, tamper-evident, and replayable. You hand an auditor the proof, not a screenshot.",
    evidence: `$ caisson audit verify --table ai_inference_log
seq 7041   sha256 4e9a…b3   prev c2f1…77   ok
seq 7042   sha256 a8d0…1c   prev 4e9a…b3   ok
seq 7043   sha256 2b6f…e9   prev a8d0…1c   ok
chain intact — 7043 rows, 0 breaks, root 9c3a…f1`,
    clause: "Art. 12(1) · Annex IV §3 (logging of operation period)",
  },
  {
    icon: "rls" as const,
    article: "Article 10 · Annex IV §2(f)",
    label: "Data governance",
    title: "Training and inference data isolated per tenant by construction.",
    body: "Article 10 requires data-governance practices covering the datasets used to train and operate the system. Fail-closed Postgres RLS ensures no query crosses a tenant boundary without an explicit, policy-enforced grant. A query that never sets the tenant context returns nothing — the control is structural, not a convention.",
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
    body: "Article 9 risk-management and Annex IV §5 require documented testing for accuracy, robustness, and cybersecurity. Caisson's eval harness runs a golden-file test suite on every pull request and fails the CI check on regression past a declared tolerance. The gate is code in the repo — diff it, reproduce it, show it to an assessor.",
    evidence: `# caisson.ai.toml — the eval gate is config, not a dashboard claim
[evals]
gate         = "ci"      # fail the PR on score drop
tolerance    = 0.02      # max allowed regression before block
golden_set   = "evals/annex-iv-accuracy.jsonl"

# CI output — assessable artifact
$ caisson eval run --report annex-iv
baseline  0.941   current  0.939   delta -0.002   PASS (< tolerance)
wrote     reports/eval-2026-06-27.json`,
    clause:
      "Art. 9(4)(b) · Annex IV §5 (testing procedures + performance metrics)",
  },
  {
    icon: "fail-closed" as const,
    article: "Article 14 · Annex IV §4",
    label: "Human oversight hooks",
    title:
      "Circuit breaker and spend cap surface override control to operators.",
    body: "Article 14 requires high-risk AI systems to allow natural persons to intervene and override automated outputs. Caisson's circuit breaker opens when a tenant's token spend exceeds a hard cap, returning HTTP 402 and surfacing the event — a structural pause that routes control back to the operator before the next call. Override and reset are explicit actions, not a dashboard hope.",
    evidence: `# caisson.ai.toml — human oversight as configuration
[caps.default]
daily_tokens  = 500_000
on_exceed     = "break"        # open circuit, halt automated calls
notify        = "ops@acme.com" # surface the pause to a human

# Override requires an explicit operator action — not automatic.
$ caisson ai cap reset --tenant acme --reason "audited + approved"
cap reset — acme may resume; action logged to audit chain`,
    clause: "Art. 14(1)(3) · Annex IV §4 (human oversight measures)",
  },
] as const;

// Evidence-pack terminal artifact for the hero right half.
function EuAiActTerminal() {
  return (
    <Terminal
      label="caisson compliance evidence-pack --framework eu-ai-act"
      status={<StatusChip label="Annex IV" tone="accent" dot />}
    >
      {`collecting   `}
      <span className="cs-tok-accent">audit chain</span>
      {` · RLS policies · field-crypto · eval report\n`}
      {`mapping      `}
      <span className="cs-tok-muted">
        Art. 10 · Art. 12 · Art. 14 · Annex IV §2–6
      </span>
      {`\n`}
      {`\n`}
      {`controls     `}
      <span className="cs-tok-success">8 mapped</span>
      {`  `}
      <span className="cs-tok-muted">0 gaps</span>
      {`\n`}
      {`wrote        `}
      <span className="cs-tok-accent">
        evidence/eu-ai-act-annex-iv-2026-06.zip
      </span>
      {`\n`}
      {`             (chain-proof.txt · rls-policies.sql\n`}
      {`              eval-report.json · field-crypto-config.json\n`}
      {`              annex-iv-control-map.json)`}
    </Terminal>
  );
}

// JSON-LD: TechArticle + BreadcrumbList.
const articleLd = techArticle({
  headline: "EU AI Act-ready technical documentation with Caisson",
  description:
    "Map EU AI Act Annex IV requirements to Caisson controls — audit chain, RLS, field-crypto, eval harness, and human-oversight hooks.",
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
            <Button href="#waitlist" variant="primary">
              Request early access
            </Button>
            <Button href="/docs" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={
          <CredentialStrip
            items={["Annex IV §2–6", "Art. 10", "Art. 12", "Art. 14"]}
            note="Evidence artifacts — not a certification or legal opinion"
          />
        }
        artifact={<EuAiActTerminal />}
      />

      {/* ===== Honesty boundary (ADR-0080 §3 — non-negotiable) ===== */}
      <Section eyebrow="What this is — and isn't" band="tint">
        <Card accent>
          <div
            style={{
              display: "grid",
              gap: "var(--cs-space-6)",
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--cs-font-mono)",
                  fontSize: "var(--cs-text-sm)",
                  color: "var(--cs-fg-accent)",
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
          your conformity assessment — a determination your legal team makes,
          not a codebase starter.
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

      {/* ===== Evidence-pack generator ===== */}
      <Reveal>
        <Section
          eyebrow="Evidence-pack generator"
          title="One command. A dated, auditor-readable bundle."
          lede="Caisson collects the live RLS policies, the audit-chain proof, the eval report, and the field-encryption config, then maps them to Annex IV sections and writes a dated zip. The evidence comes from the system that actually enforces it."
          band="surface"
        >
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <CodeBlock
              label="caisson compliance evidence-pack --framework eu-ai-act"
              frame
              status={<StatusChip label="Annex IV" tone="accent" dot />}
              code={
                <>
                  {`collecting   `}
                  <span className="cs-tok-accent">audit chain</span>
                  {` · RLS policies · field-crypto · eval report\n`}
                  {`mapping      Art. 10 · Art. 12 · Art. 14 · Annex IV §2–6\n\n`}
                  {`controls     `}
                  <span className="cs-tok-success">8 mapped</span>
                  {`  `}
                  <span className="cs-tok-muted">0 gaps detected\n\n</span>
                  {`wrote        evidence/eu-ai-act-annex-iv-2026-06.zip\n`}
                  {`             chain-proof.txt\n`}
                  {`             rls-policies.sql\n`}
                  {`             eval-report.json\n`}
                  {`             field-crypto-config.json\n`}
                  {`             `}
                  <span className="cs-tok-accent">
                    annex-iv-control-map.json
                  </span>
                </>
              }
            />
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-5)" }}>
            The EU AI Act-ready pack ships as an add-on to the Compliance
            edition — sold worldwide, never geo-restricted.
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
              a default. The controls are structural — and testable before your
              first customer, not backfilled before your first notified-body
              assessment.
            </p>
          </Card>
        </Section>
      </Reveal>

      {/* ===== Waitlist ===== */}
      <Section eyebrow="Early access" id="waitlist">
        <h2 className="cs-section-title">
          Ship with the evidence already in the repo.
        </h2>
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          Join the early-access list. The EU AI Act-ready add-on ships with the
          Compliance edition — we&apos;ll reach out as it opens.
        </p>
        <WaitlistForm source="eu-ai-act" />
      </Section>
    </>
  );
}
