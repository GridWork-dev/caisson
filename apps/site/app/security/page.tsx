import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
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
    "How Caisson secures the controls it generates and this site itself: fail-closed RLS, a resolve-and-recheck SSRF guard, timing-safe comparisons, and an admin app gated by a fail-closed CF-Access JWT check. Caisson generates audit evidence; it is not an auditor.",
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
    body: "packages/tenancy-rls's buildTenantPolicySql emits ENABLE ROW LEVEL SECURITY plus FORCE ROW LEVEL SECURITY on every tenant table, so the policy binds the table owner too — not just other roles. The sole entry point, withTenant, opens a transaction, drops to the unprivileged app role, and binds the account id into a Postgres GUC (app.current_account) that every policy reads; a code path that forgets withTenant has no GUC bound and the table returns nothing. A one-time role pre-flight (assertRoleNotPrivileged) refuses to run if that role is ever a superuser or BYPASSRLS, since either would silently no-op FORCE ROW LEVEL SECURITY. Cross-tenant isolation is a CI test, not a convention.",
  },
  {
    icon: "shield",
    label: "Resolve-and-recheck SSRF guard",
    body: `packages/kernel's ssrf.ts stops DNS rebinding on every buyer- or config-supplied URL — the alerting webhook transports and the ai-kit provider baseUrl both route through it (ADR-0204, closing Strix finding vuln-0004). assertSafePublicUrl rejects non-https, credentials-in-URL, and a literal private/loopback/link-local/metadata host at the config boundary; assertResolvedHostPublic then resolves the hostname and re-checks every returned A/AAAA record against the same denylist immediately before the outbound fetch, so a public name that DNS-rebinds to 127.0.0.1 or 169.254.169.254 is caught where a literal-only check can't see it. ssrfGuardedFetch forces redirect: "error" — only the original host is re-checked, so a followed redirect could otherwise carry the request past the guard.`,
  },
  {
    icon: "worm",
    label: "WORM storage",
    body: "Evidence buckets enable S3 Object Lock. The default is GOVERNANCE mode — inside the retention window an object cannot be overwritten or deleted by an app bug or an ordinary operator, though a caller holding s3:BypassGovernanceRetention can still override it. COMPLIANCE mode is available as an explicit, irreversible opt-in (production-only, gated behind irreversibleComplianceOptIn) for retention even the AWS account root cannot shorten.",
  },
  {
    icon: "audit-chain",
    label: "Append-only audit chain",
    body: "Each audit row commits SHA-256 over the previous hash plus its own payload. Tampering with any historical row breaks every link after it, and the break is detectable, provable, and exportable.",
  },
  {
    icon: "key",
    label: "Timing-safe comparisons",
    body: "packages/kernel's crypto.ts is the one home for secret comparison: safeEqualFixed converts both sides to equal-length buffers and runs node:crypto's timingSafeEqual for session tokens and HMAC outputs of known length; safeEqualVariable SHA-256-hashes both sides first for variable-length values like an admin-email allowlist entry, because a raw variable-length timingSafeEqual throws on a length mismatch and leaks a boolean through the catch. verifyAllowlisted scans every allowlist entry with no early return, so the timing never reveals which entry matched.",
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
    title: "Admin gated by a fail-closed CF-Access JWT check",
    body: "apps/admin renders cross-tenant business data and ships no other auth, so ADR-0204 added an app-wide middleware.ts that validates Cf-Access-Jwt-Assertion against the admin Access application's JWKS, pins the aud claim to the admin app specifically (the site and admin Access apps share one email policy, so a signature-only check would accept a site token), and denies with a 403 on any failure — expired token, wrong aud/iss, unreachable JWKS, or a request that reached the raw Railway origin directly, bypassing the Cloudflare edge entirely. In production, an unconfigured gate also denies: both CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD must be set before the app serves a single route.",
  },
  {
    icon: "gauge",
    title: "Hardened response headers",
    body: "Every response carries HSTS with preload, X-Content-Type-Options: nosniff, X-Frame-Options: DENY, a strict Referrer-Policy, a closed Permissions-Policy, and a tightened Content-Security-Policy.",
  },
  {
    icon: "lock",
    title: "Cookieless analytics, self-hosted fonts",
    body: "Analytics run through Plausible — no cookies, no cross-site identifiers, no consent banner because there is nothing to consent to. Fonts ship from our own origin via next/font, so font-src stays locked to 'self' with no third-party font CDN in the trust surface.",
  },
  {
    icon: "key",
    title: "Validated forms endpoint",
    body: "The ask-AI and waitlist routes both validate input with Zod .strict() — unknown fields rejected — and gate on a Cloudflare Turnstile token before any request reaches the model or the mailing list. makeTurnstileVerifier fails closed on the ask route; the waitlist route also drops bots via a honeypot field.",
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
    question:
      "What stops a DNS-rebinding attack against a webhook or provider URL I configure?",
    answer:
      "packages/kernel's ssrf.ts resolves the hostname and re-checks every returned IP against a private/loopback/link-local/metadata denylist immediately before the outbound fetch, and forces the request to fail on any redirect. A literal-only check (the pre-ADR-0204 state) can't see a name that resolves into private space after the fact; the resolve-and-recheck design closes that gap for both the alerting transports and the ai-kit provider baseUrl.",
  },
  {
    question:
      "How is the admin dashboard protected if it renders every tenant's data?",
    answer:
      "Two independent layers: Cloudflare Access gates the edge, and apps/admin's own middleware.ts independently verifies the Cf-Access-Jwt-Assertion token's signature, audience, and issuer before any route runs, denying with a 403 on failure or misconfiguration. A request that reaches the raw Railway origin directly — bypassing Cloudflare — still hits this in-app check and is refused.",
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
  script-src 'self' 'unsafe-inline' https://plausible.io https://cdn.paddle.com
    https://challenges.cloudflare.com;
  frame-src https://*.paddle.com https://challenges.cloudflare.com;
  connect-src 'self' https://plausible.io https://*.paddle.com
    https://challenges.cloudflare.com`;

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
          lede="The same posture Caisson generates for your app governs this site: deny by default, prove it with code, claim nothing we do not ship. Caisson generates audit evidence — it is not the auditor."
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
              items={[
                "HSTS preload",
                "Fail-closed RLS",
                "Resolve-recheck SSRF guard",
                "RFC 9116",
              ]}
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
referrer-policy: strict-origin-when-cross-
  origin
permissions-policy: geolocation=(),
  microphone=(), camera=()
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
          <FeatureGrid cols={3}>
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
          </FeatureGrid>
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
                exactly three third parties, each scoped to the surface that
                uses it: Plausible for cookieless analytics, Paddle (
                <code className="mono">cdn.paddle.com</code> for the checkout
                script, <code className="mono">*.paddle.com</code> for its
                overlay iframe and API), and Cloudflare Turnstile (
                <code className="mono">challenges.cloudflare.com</code>) for the
                invisible bot check on the Ask-AI assistant — nothing wider.
                Tightening the inline residual to per-script hashes is a tracked
                follow-up, not a shipped claim.
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
                cannot be. It maps the live RLS policies, the SSRF guard, WORM
                retention, and the audit-chain proof to named controls so you
                can hand an auditor the evidence, not a screenshot. The
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
          {/* Bare <Faq>, matching ai-kit/compliance — a Card wrapper here double-borders the
           * accordion rows (Faq draws its own per-row surface). D8(a) vetoable call. */}
          <Faq items={FAQ} style={{ marginTop: "var(--cs-space-8)" }} />
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
