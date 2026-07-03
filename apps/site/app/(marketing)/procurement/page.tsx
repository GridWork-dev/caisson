import { Button, Section, Card, Faq, Icon, Reveal } from "@/components";
import { buildMetadata } from "@/lib/metadata";
import { serializeJsonLd, breadcrumb, faqPage } from "@/lib/jsonld";

export const metadata = buildMetadata({
  title: "Security & procurement",
  description:
    "For security teams and procurement: what Caisson ships as technical controls, the entity you're buying from, how Paddle (merchant of record) handles invoicing and refunds, and how to request documentation or report a vulnerability.",
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
    body: "Evidence buckets default to GOVERNANCE-mode Object Lock: objects can't be overwritten or deleted inside the retention window by an ordinary caller. Escalating a bucket to COMPLIANCE mode — where the lock holds against any caller, including an operator with a leaked root key — is an explicit, irreversible, production-gated opt-in, never the silent default.",
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
    question: "Who is the seller — GridWork Digital LLC or Paddle?",
    answer:
      "Both, in different roles. Paddle.com is the merchant of record: it's the seller on your transaction, it collects payment, calculates and remits tax, and issues your receipt. GridWork Digital LLC, based in Atlanta, Georgia, is the licensor: it owns the Caisson source and grants you the license under the Commercial License Agreement. Your receipt comes from Paddle; your software rights come from GridWork.",
  },
  {
    question: "Is the license a one-time purchase or a subscription?",
    answer:
      "One-time. The perpetual license fee is a single charge per edition or module, and the license doesn't expire, doesn't require renewal, and verifies offline — no call home required. Compliance Updates is a separate, optional, recurring subscription that delivers new package versions with updated control mappings; skipping or cancelling it doesn't affect the perpetual license you already hold.",
  },
  {
    question: "What's the refund policy?",
    answer:
      "Buyers in the EU, EEA, UK, and Switzerland get a statutory 14-day withdrawal right under Paddle's buyer terms. Because Caisson is downloadable software delivered for immediate use, that right ends once you consent to immediate access at checkout and then download, install, or use it. Outside that window, refund requests are reviewed case by case. Email legal@gridwork.dev with your order number, or contact Paddle directly at paddle.net. An approved refund revokes the entitlement it granted and returns unused credits; a multi-item order can be refunded line by line.",
  },
  {
    question: "How do I request security documentation?",
    answer:
      "Email security@caisson.sh with your organization name and what you need (architecture diagram, control mapping, data-flow documentation). We respond to documented requests within 5 business days.",
  },
  {
    question:
      "Can you provide a W-9 or entity documentation for our vendor file?",
    answer:
      "Yes. Email legal@gridwork.dev with your organization name and we'll send a completed W-9 and GridWork Digital LLC's entity details.",
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
        lede="For security teams, procurement reviewers, and budget-holders: the scope of the technical controls, the boundary between what Caisson ships and what remains yours, who you're buying from and how invoicing works, and how to request documentation."
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

      {/* ===== Who you're buying from ===== */}
      <Section
        band="tint"
        eyebrow="Who you're buying from"
        title="The entity and the licensing relationship."
      >
        <p className="cs-lede">
          Caisson is licensed to you by GridWork Digital LLC, based in Atlanta,
          Georgia. That&rsquo;s the party behind the software: it owns the
          source, grants the license, and stands behind it under the Commercial
          License Agreement (the EULA) — see the EULA for the entity&rsquo;s
          full legal description.
        </p>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-4)" }}>
          Your checkout is handled by a separate party — see the next section.
          Two different roles, both named on your paperwork: GridWork licenses
          the software, Paddle sells and bills the transaction.
        </p>
        <div style={{ marginTop: "var(--cs-space-6)" }}>
          <Button href="/legal/eula" variant="ghost">
            Read the full license terms
          </Button>
        </div>
      </Section>

      {/* ===== Invoicing & merchant of record ===== */}
      <Section
        eyebrow="Invoicing & billing"
        title="Paddle is the merchant of record."
      >
        <p className="cs-lede">
          Every order runs through Paddle.com, Caisson&rsquo;s merchant of
          record. Paddle collects payment, calculates and remits sales tax and
          VAT for your jurisdiction, and issues your order receipt — that
          receipt is your invoice for the purchase. Which Paddle entity is the
          seller of record for your specific order is stated in Paddle&rsquo;s
          own buyer terms, presented to you at checkout.
        </p>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-4)" }}>
          The perpetual license fee is a one-time charge per edition or module.
          A Compliance Updates subscription, where purchased, bills on a
          recurring basis until cancelled and delivers new package versions with
          updated control mappings — it&rsquo;s optional and doesn&rsquo;t
          affect the perpetual license for versions you already have. The
          license itself doesn&rsquo;t expire, doesn&rsquo;t require renewal,
          and doesn&rsquo;t call home to stay valid.
        </p>
        <p className="cs-muted" style={{ marginTop: "var(--cs-space-4)" }}>
          Refunds: consumers in the EU, EEA, UK, and Switzerland have a
          statutory 14-day withdrawal right under Paddle&rsquo;s buyer terms.
          Because Caisson is downloadable software delivered for immediate use,
          consenting to immediate access at checkout and then downloading,
          installing, or using it ends that statutory right for that purchase.
          Outside the statutory window, refund requests are reviewed case by
          case under Paddle&rsquo;s buyer terms. An approved refund revokes the
          entitlement it granted and returns unused credits; access and credits
          already used aren&rsquo;t clawed back. If one order covered more than
          one edition or module, tell us which line item you&rsquo;re refunding
          — they&rsquo;re refundable individually.
        </p>
        <div style={{ marginTop: "var(--cs-space-6)" }}>
          <Button href="/legal/terms" variant="ghost">
            Refund & payment terms in full
          </Button>
        </div>
      </Section>

      {/* ===== Documentation requests ===== */}
      <Section
        band="tint"
        eyebrow="Documentation requests"
        title="How to request security and tax docs."
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
              label: "W-9 and entity documents",
              body: "Email legal@gridwork.dev with your organization name and we'll send a completed W-9 and GridWork Digital LLC's entity details for your vendor file.",
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
          For security documentation, procurement questionnaires, W-9 requests,
          or to discuss the technical controls in detail, email{" "}
          <a
            href="mailto:security@caisson.sh"
            style={{ color: "var(--cs-link)" }}
          >
            security@caisson.sh
          </a>{" "}
          (security/technical) or{" "}
          <a
            href="mailto:legal@gridwork.dev"
            style={{ color: "var(--cs-link)" }}
          >
            legal@gridwork.dev
          </a>{" "}
          (contracts, tax, entity). Ready to purchase or evaluate? See pricing.
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
