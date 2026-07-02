import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import {
  Button,
  Card,
  CredentialStrip,
  Hero,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
  type IconName,
} from "@/components";
import { buildMetadata } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  techArticle,
} from "@/lib/jsonld";

export const metadata = buildMetadata({
  title: "Security",
  description:
    "How Caisson secures the controls it generates — fail-closed RLS, WORM storage, an append-only audit chain — and this site: a hardened CSP, cookieless analytics, and a responsible-disclosure policy. Caisson generates audit evidence; it is not an auditor.",
  path: "/security",
});

// Product controls Caisson ships into the buyer's app — distinct from this site's own posture.
// Each line states what actually ships, no certification language.
const PRODUCT_CONTROLS: ReadonlyArray<{
  icon: IconName;
  label: string;
  body: string;
}> = [
  {
    icon: "rls",
    label: "Fail-closed RLS",
    body: "Tenant tables ENABLE and FORCE Postgres row-level security, so the policy binds the owner too. A query that never set the tenant context returns nothing — not everything. Cross-tenant isolation is a CI test, not a convention.",
  },
  {
    icon: "worm",
    label: "WORM storage",
    body: "Evidence buckets enable S3 Object Lock in COMPLIANCE mode with a default retention. Inside the window an object cannot be overwritten or deleted — not by an app bug, an operator, or a leaked root key.",
  },
  {
    icon: "audit-chain",
    label: "Append-only audit chain",
    body: "Each audit row commits SHA-256 over the previous hash plus its payload. Tampering with any historical row breaks every link after it, and the break is detectable, provable, and exportable.",
  },
  {
    icon: "field-crypto",
    label: "Per-tenant field crypto",
    body: "Sensitive columns are sealed with a data key derived per tenant via HKDF-SHA256. A leaked tenant key exposes one tenant, never the table; rotating the root re-derives every key without a re-encrypt scan.",
  },
];

// This site's own posture — only what actually ships on caisson.sh.
const SITE_POSTURE: ReadonlyArray<{
  icon: IconName;
  title: string;
  body: string;
}> = [
  {
    icon: "server",
    title: "Dynamic app, minimal surface",
    body: "caisson.sh runs as a Next.js standalone Node server on Railway, backed by Postgres for the buyer dashboard, billing, and checkout. Marketing and docs pages still render statically at build time; only the dashboard, checkout, and forms are dynamic, and every authed route runs the same fail-closed tenant isolation the product ships — no secrets in the client bundle.",
  },
  {
    icon: "shield",
    title: "Hardened response headers",
    body: "Every response carries HSTS with preload, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, a strict Referrer-Policy, a closed Permissions-Policy, and a tightened Content-Security-Policy.",
  },
  {
    icon: "gauge",
    title: "Cookieless analytics",
    body: "Analytics run through Plausible — no cookies, no cross-site identifiers, no consent banner because there is nothing to consent to. The CSP's script-src allows exactly two third-party origins: Plausible for analytics, and Paddle for checkout (see the CSP section below).",
  },
  {
    icon: "lock",
    title: "Self-hosted fonts",
    body: "Fonts ship from our own origin via next/font — no third-party font CDN. font-src is locked to 'self', removing an external origin from the trust surface.",
  },
  {
    icon: "key",
    title: "Validated forms endpoint",
    body: "The forms function validates input with Zod .strict() (unknown fields rejected), drops bots via a honeypot, and carries an env-gated Turnstile verification seam plus a documented per-IP rate-limit binding as the next step.",
  },
  {
    icon: "file-check",
    title: "Responsible disclosure",
    body: "A machine-readable policy lives at /.well-known/security.txt (RFC 9116). Report anything you find to security@caisson.sh — we read it.",
  },
];

// A real, visible FAQ — drives the precise-scope honesty law (ADR-0080 §3). FAQPage JSON-LD is
// emitted only because these questions render on the page.
const FAQ: ReadonlyArray<{ question: string; answer: string }> = [
  {
    question: "Is Caisson SOC 2 or HIPAA certified?",
    answer:
      "No. Caisson is a codebase, not an auditor. It ships the technical controls those frameworks require — fail-closed RLS, WORM storage, an append-only audit chain — and generates the evidence pack you hand your auditor. The audit itself and your organizational controls (HR, vendor, incident response) remain yours.",
  },
  {
    question: "Does this site set tracking cookies?",
    answer:
      "No. Analytics are cookieless (Plausible), there are no third-party trackers, and there is no consent banner because nothing is stored on your device.",
  },
  {
    question: "How do I report a vulnerability?",
    answer:
      "Email security@caisson.sh, or read the machine-readable policy at /.well-known/security.txt. There is no bug-bounty program yet; we still want the report.",
  },
];

const SHIPPED_CSP = `$ curl -sI https://caisson.sh | grep -i '^content-security-policy'
content-security-policy: default-src 'self'; base-uri 'self';
  object-src 'none'; frame-ancestors 'none'; form-action 'self';
  img-src 'self' data: https://*.paddle.com; font-src 'self';
  style-src 'self' 'unsafe-inline' https://*.paddle.com;
  script-src 'self' 'unsafe-inline' https://plausible.io https://cdn.paddle.com;
  frame-src https://*.paddle.com;
  connect-src 'self' https://plausible.io https://*.paddle.com`;

export default function SecurityPage() {
  const jsonLd = [
    breadcrumb([
      { name: "Home", path: "/" },
      { name: "Security", path: "/security" },
    ]),
    techArticle({
      headline: "Caisson security & trust posture",
      description:
        "The product controls Caisson generates and the security posture of caisson.sh, stated precisely — no certification claims.",
      url: "https://caisson.sh/security",
    }),
    faqPage(FAQ),
  ];

  return (
    <>
      {jsonLd.map((node) => (
        <script
          key={node["@type"]}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
        />
      ))}
      <SiteNav />
      <main id="main-content">
        {/* ===== Hero ===== */}
        <Hero
          eyebrow="Security & trust"
          title="Fail-closed by construction."
          lede="The same posture Caisson generates for your app governs this site: deny by default, prove on demand, and claim nothing we do not ship. Caisson generates the audit evidence — it is not the auditor."
          ctas={
            <>
              <Button href="mailto:security@caisson.sh" external>
                Report a vulnerability
              </Button>
              <Button href="/docs" variant="ghost">
                Read the docs
              </Button>
            </>
          }
          credentials={
            <CredentialStrip
              items={["HSTS preload", "Strict CSP", "Cookieless", "RFC 9116"]}
              note="The shipped posture, not a roadmap."
            />
          }
          artifact={
            <Terminal
              label="response headers · caisson.sh"
              status={<StatusChip label="enforced" tone="success" dot />}
            >
              {`$ curl -sI https://caisson.sh
strict-transport-security: max-age=63072000;
  includeSubDomains; preload
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: strict-origin-when-cross-origin
permissions-policy: geolocation=(), microphone=(),
  camera=()
content-security-policy: default-src 'self'; …`}
            </Terminal>
          }
        />

        {/* ===== Product controls (what Caisson generates) ===== */}
        <Section
          band="tint"
          eyebrow="Controls Caisson generates"
          title="The security your app inherits on day one."
          lede="These are product features — wired and tested into the codebase Caisson generates, not services we run on your behalf. You own the source and the evidence."
        >
          <div className="cs-grid" style={{ marginTop: "var(--cs-space-8)" }}>
            {PRODUCT_CONTROLS.map((c) => (
              <Reveal as="article" key={c.label}>
                <Card>
                  <div className="cs-status">
                    <Icon name={c.icon} />
                    {c.label}
                  </div>
                  <p
                    className="cs-muted"
                    style={{
                      marginTop: "var(--cs-space-3)",
                      maxWidth: "70ch",
                    }}
                  >
                    {c.body}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ===== This site's posture ===== */}
        <Section
          eyebrow="This site"
          title="How caisson.sh itself is secured."
          lede="A dynamic app widens the attack surface — we keep it deliberately scoped and document exactly what ships."
        >
          <div
            className="cs-grid cs-grid--3"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            {SITE_POSTURE.map((p) => (
              <Reveal as="article" key={p.title}>
                <Card>
                  <div className="cs-status">
                    <Icon name={p.icon} />
                    {p.title}
                  </div>
                  <p
                    className="cs-muted"
                    style={{ marginTop: "var(--cs-space-3)" }}
                  >
                    {p.body}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ===== The shipped CSP, with the honest residual ===== */}
        <Section
          band="surface"
          eyebrow="Content-Security-Policy"
          title="The policy that ships — including what is not yet locked down."
          lede="We state CSP residuals plainly rather than imply a tighter policy than we run. Trust is the product; over-claiming it would defeat the point."
        >
          <Reveal>
            <Terminal
              label="content-security-policy"
              status={<StatusChip label="live" tone="success" dot />}
            >
              {SHIPPED_CSP}
            </Terminal>
          </Reveal>
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <Card>
              <div className="cs-status">
                <Icon name="alert" />
                The one honest residual
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)", maxWidth: "76ch" }}
              >
                <code className="mono">script-src</code> and{" "}
                <code className="mono">style-src</code> still allow{" "}
                <code className="mono cs-tok-muted">
                  &apos;unsafe-inline&apos;
                </code>
                . Next inlines its own hydration bootstrap with no per-request
                nonce under the App Router, so those inline tags cannot be hash-
                or nonce-gated without breaking hydration. Beyond{" "}
                <code className="mono">&apos;self&apos;</code> the policy allows
                exactly two third parties, each scoped to the surface that uses
                it: Plausible for cookieless analytics, and Paddle (
                <code className="mono">cdn.paddle.com</code> for the checkout
                script, <code className="mono">*.paddle.com</code> for its
                overlay iframe and API) — nothing wider. Tightening the inline
                residual to per-script hashes is a tracked follow-up, not a
                shipped claim.
              </p>
            </Card>
          </div>
        </Section>

        {/* ===== The honesty boundary ===== */}
        <Section
          eyebrow="The honesty boundary"
          title="Caisson generates evidence. It is not an auditor."
        >
          <div style={{ marginTop: "var(--cs-space-4)" }}>
            <Card accent>
              <p
                style={{
                  fontSize: "var(--cs-text-xl)",
                  lineHeight: "var(--cs-leading-relaxed)",
                  letterSpacing: "var(--cs-tracking-tight)",
                  maxWidth: "56ch",
                }}
              >
                Caisson ships the technical controls a framework asks for and
                generates the evidence pack. The audit, and your organizational
                controls, stay yours.
              </p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-4)", maxWidth: "64ch" }}
              >
                We never imply Caisson is SOC 2 or HIPAA certified — a codebase
                cannot be. It maps the live RLS policies, WORM retention, and an
                audit-chain proof to named controls so you can hand an auditor
                the evidence, not a screenshot. The
                technical-versus-administrative line is drawn on purpose, and we
                keep it visible.
              </p>
            </Card>
          </div>
        </Section>

        {/* ===== FAQ ===== */}
        <Section
          band="tint"
          eyebrow="Straight answers"
          title="The questions procurement asks first."
        >
          <div
            className="cs-grid"
            style={{ marginTop: "var(--cs-space-8)", gap: "var(--cs-space-5)" }}
          >
            {FAQ.map((item) => (
              <Reveal as="article" key={item.question}>
                <Card>
                  <h3 className="cs-card-title">{item.question}</h3>
                  <p
                    className="cs-muted"
                    style={{ marginTop: "var(--cs-space-3)", maxWidth: "74ch" }}
                  >
                    {item.answer}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* ===== Disclosure CTA ===== */}
        <Section
          eyebrow="Responsible disclosure"
          title="Found something? Tell us."
          lede="We publish a machine-readable policy and read every report. No bounty program yet — the report still matters."
        >
          <div className="cs-cta-row">
            <Button href="mailto:security@caisson.sh" external>
              security@caisson.sh
            </Button>
            <Button href="/.well-known/security.txt" variant="ghost" external>
              security.txt
            </Button>
          </div>
        </Section>
      </main>
      <SiteFooter />
    </>
  );
}
