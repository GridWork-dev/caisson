import { Button, Section, Card, Faq, Icon, Reveal } from "@/components";
import { buildMetadata } from "@/lib/metadata";
import { serializeJsonLd, breadcrumb, faqPage } from "@/lib/jsonld";

export const metadata = buildMetadata({
  title: "Security & procurement",
  description:
    "For security teams and procurement: what Caisson ships (technical controls), the technical-vs-administrative boundary, how to request documentation, and where to report a vulnerability.",
  path: "/procurement",
});

const WHAT_CAISSON_SHIPS = [
  {
    icon: "rls" as const,
    label: "Fail-closed Postgres RLS",
    body: "FORCE-enabled row-level security. A query that never sets the tenant context returns nothing. Cross-tenant isolation is a test in CI, not a convention.",
    control: "SOC 2 CC6.1 · HIPAA §164.312(a)(1)",
  },
  {
    icon: "worm" as const,
    label: "S3 Object-Lock WORM storage",
    body: "Evidence buckets in COMPLIANCE mode with a default retention period. Objects cannot be overwritten or deleted inside the window — for any caller, including an operator with a leaked root key.",
    control: "SOC 2 CC7.2 · HIPAA §164.312(c)(1)",
  },
  {
    icon: "audit-chain" as const,
    label: "Append-only SHA-256 audit chain",
    body: "Every privileged action hashes into a chain. Tampering with any historical row breaks every link after it — the break is detectable, provable, and exportable to an auditor.",
    control: "SOC 2 CC7.2 · HIPAA §164.312(b)",
  },
  {
    icon: "field-crypto" as const,
    label: "Per-tenant field encryption",
    body: "AES-256-GCM authenticated encryption at the column level. Each tenant's key material is scoped to their row context. No plaintext key material in the application layer.",
    control: "HIPAA §164.312(a)(2)(iv)",
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "Is Caisson SOC 2 or HIPAA certified?",
    answer:
      "No. Caisson is a codebase that ships the technical controls required by those frameworks. The certification, the audit engagement, and the organizational controls (HR, vendor management, incident response) remain yours. Caisson generates the evidence; you close the audit. That boundary is stated plainly in the documentation and is intentional.",
  },
  {
    question: "What controls does Caisson cover?",
    answer:
      "The Compliance edition covers the technical controls in SOC 2 CC6.1 (logical access), CC7.2 (change detection, stored evidence), and HIPAA §164.312(a)(1) (access control), §164.312(b) (audit controls), §164.312(c)(1) (integrity), and §164.312(a)(2)(iv) (encryption/decryption). The organizational and administrative controls remain the operator's responsibility.",
  },
  {
    question: "How do I request security documentation?",
    answer:
      "Email security@caisson.sh with your organization name and what you need (architecture diagram, control mapping, data-flow documentation). We respond to documented requests within 5 business days.",
  },
  {
    question: "How do I report a vulnerability?",
    answer:
      "Email security@caisson.sh with a description and reproduction steps. We do not currently run a formal bug-bounty program, but we acknowledge and triage every valid report. A security.txt file is available at https://caisson.sh/.well-known/security.txt.",
  },
  {
    question: "Where is data processed and stored?",
    answer:
      "Caisson is a codebase deployed into your infrastructure — it does not process or store your data on Caisson-operated systems. The RLS, WORM, and audit-chain controls run inside your Postgres and S3-compatible storage.",
  },
];

export default function ProcurementPage() {
  const ldBreadcrumb = breadcrumb([
    { name: "Caisson", path: "/" },
    { name: "Security & procurement", path: "/procurement" },
  ]);
  const ldFaq = faqPage(FAQ_ITEMS);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldBreadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(ldFaq) }}
      />

      {/* ===== Header ===== */}
      <Section
        flush
        as="h1"
        eyebrow="Security & procurement"
        title="What to expect from Caisson."
        lede="For security teams, procurement reviewers, and budget-holders: the scope of the technical controls, the boundary between what Caisson ships and what remains yours, and how to request documentation."
      />

      {/* ===== The boundary statement ===== */}
      <Section band="tint" eyebrow="The boundary">
        <Card accent>
          <p
            style={{
              fontSize: "var(--cs-text-lg)",
              fontWeight: "var(--cs-weight-medium)",
              lineHeight: "var(--cs-leading-snug)",
              marginBottom: "var(--cs-space-4)",
            }}
          >
            Caisson ships the technical controls. The audit remains yours.
          </p>
          <p className="cs-muted">
            Caisson is a codebase. It implements the technical requirements
            SOC&nbsp;2 and HIPAA demand — fail-closed access control,
            tamper-evident logging, WORM storage, and encrypted field storage.
            It generates evidence artifacts you hand to an auditor. It does not
            replace the auditor, the audit engagement, or the organizational
            controls (HR, vendor management, incident response) the frameworks
            also require. Caisson is not itself SOC&nbsp;2 or HIPAA certified,
            and never claims to be.
          </p>
        </Card>
      </Section>

      {/* ===== Technical controls ===== */}
      <Section
        eyebrow="Technical controls"
        title="Compliance edition: what it ships."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
            gap: "var(--cs-space-4)",
            marginTop: "var(--cs-space-8)",
          }}
        >
          {WHAT_CAISSON_SHIPS.map((item, i) => (
            <Reveal key={item.label} delay={i * 50} as="article">
              <Card>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cs-space-3)",
                    marginBottom: "var(--cs-space-3)",
                  }}
                >
                  <Icon name={item.icon} size="lg" aria-hidden />
                  <span
                    style={{
                      fontWeight: "var(--cs-weight-medium)",
                      fontSize: "var(--cs-text-sm)",
                    }}
                  >
                    {item.label}
                  </span>
                </div>
                <p
                  className="cs-muted"
                  style={{ marginBottom: "var(--cs-space-4)" }}
                >
                  {item.body}
                </p>
                <p
                  className="cs-num"
                  style={{
                    fontFamily: "var(--cs-font-mono)",
                    fontSize: "var(--cs-text-xs)",
                    color: "var(--cs-fg-muted)",
                  }}
                >
                  {item.control}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ===== Documentation requests ===== */}
      <Section
        band="tint"
        eyebrow="Documentation requests"
        title="How to request security docs."
      >
        <p className="cs-lede">
          We respond to documented requests from security reviewers and
          procurement teams within 5 business days.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
            gap: "var(--cs-space-4)",
            marginTop: "var(--cs-space-8)",
          }}
        >
          {[
            {
              label: "Architecture & data-flow",
              body: "System architecture diagram, data-flow documentation, and infrastructure topology. Available on request.",
            },
            {
              label: "Control mapping",
              body: "A mapping of Caisson modules to SOC 2 TSC and HIPAA §164.3xx control clauses. Downloadable in CSV and PDF.",
            },
            {
              label: "Vulnerability reporting",
              body: "Email security@caisson.sh with a description and reproduction steps. We triage every valid report. No formal bug-bounty yet.",
            },
            {
              label: "Procurement questionnaires",
              body: "Send your standard security questionnaire to security@caisson.sh. We respond to documented requests from qualified buyers.",
            },
          ].map((item, i) => (
            <Reveal key={item.label} delay={i * 50} as="article">
              <Card>
                <p
                  style={{
                    fontWeight: "var(--cs-weight-medium)",
                    fontSize: "var(--cs-text-sm)",
                    marginBottom: "var(--cs-space-3)",
                  }}
                >
                  {item.label}
                </p>
                <p className="cs-muted">{item.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        <div
          style={{
            marginTop: "var(--cs-space-8)",
            display: "flex",
            gap: "var(--cs-space-3)",
            flexWrap: "wrap",
          }}
        >
          <Button href="mailto:security@caisson.sh" external variant="primary">
            Email security@caisson.sh
          </Button>
          <Button href="/.well-known/security.txt" external variant="ghost">
            security.txt
          </Button>
          <Button href="/security" variant="ghost">
            Security page
          </Button>
        </div>
      </Section>

      {/* ===== FAQ ===== */}
      <Section eyebrow="Procurement FAQ" title="Common questions.">
        <Faq items={FAQ_ITEMS} style={{ marginTop: "var(--cs-space-8)" }} />
      </Section>

      {/* ===== Contact nudge ===== */}
      <Section band="surface" eyebrow="Get started">
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-5)" }}>
          For security documentation, procurement questionnaires, or to discuss
          the technical controls in detail, email{" "}
          <a
            href="mailto:security@caisson.sh"
            style={{ color: "var(--cs-link)" }}
          >
            security@caisson.sh
          </a>
          . Ready to purchase or evaluate? See pricing.
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            flexWrap: "wrap",
          }}
        >
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
