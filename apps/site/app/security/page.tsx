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
import { CONTENT_SECURITY_POLICY } from "@/lib/security-headers";
import { SECURITY_FAQ, SECURITY_META_DESCRIPTION } from "@/lib/security-copy";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  techArticle,
} from "@/lib/jsonld";

export const metadata = buildMetadata({
  title: "Security",
  description: SECURITY_META_DESCRIPTION,
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
    body: "packages/tenancy-rls's buildTenantPolicySql emits ENABLE ROW LEVEL SECURITY plus FORCE ROW LEVEL SECURITY on every tenant table, so the policy binds the table owner too, not just other roles. The sole entry point, withTenant, opens a transaction, drops to the unprivileged app role, and binds the account id into a Postgres GUC (app.current_account) that every policy reads; a code path that forgets withTenant has no GUC bound and the table returns nothing. A one-time role pre-flight (assertRoleNotPrivileged) refuses to run if that role is ever a superuser or BYPASSRLS, since either would silently no-op FORCE ROW LEVEL SECURITY. Cross-tenant isolation is a CI test, not a convention.",
  },
  {
    icon: "shield",
    label: "Resolve-and-recheck SSRF guard",
    body: `packages/kernel's ssrf.ts stops DNS rebinding on every buyer- or config-supplied URL (the alerting webhook transports and the AI-Production provider baseUrl both route through it. assertSafePublicUrl rejects non-https, credentials-in-URL, and a literal private/loopback/link-local/metadata host at the config boundary; assertResolvedHostPublic then resolves the hostname and re-checks every returned A/AAAA record against the same denylist immediately before the outbound fetch, so a public name that DNS-rebinds to 127.0.0.1 or 169.254.169.254 is caught where a literal-only check can't see it. ssrfGuardedFetch forces redirect: "error") only the original host is re-checked, so a followed redirect could otherwise carry the request past the guard.`,
  },
  {
    icon: "worm",
    label: "WORM storage",
    body: "Evidence buckets enable S3 Object Lock. The default is GOVERNANCE mode, inside the retention window an object cannot be overwritten or deleted by an app bug or an ordinary operator, though a caller holding s3:BypassGovernanceRetention can still override it. COMPLIANCE mode is available as an explicit, irreversible opt-in (production-only, gated behind irreversibleComplianceOptIn) for retention even the AWS account root cannot shorten.",
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
    title: "Static site, no origin",
    body: "caisson.sh is a static export served from Cloudflare's edge. Every page and the search index are prebuilt files: no origin server, no database, no sign-in, and no secrets anywhere in the build.",
  },
  {
    icon: "shield",
    title: "Nothing to submit",
    body: "There are no forms and no API routes that accept input. Search runs entirely in your browser over a prebuilt index, so a query never leaves the page.",
  },
  {
    icon: "gauge",
    title: "Hardened response headers",
    body: "Every response carries HSTS with preload, X-Content-Type-Options: nosniff, a strict Referrer-Policy, a closed Permissions-Policy, and a tightened Content-Security-Policy. Framing is denied outright on every page, with one exception: the /demos/* embed surface, which a module page frames on this same origin and which no other site can frame.",
  },
  {
    icon: "lock",
    title: "Cookieless analytics, self-hosted fonts",
    body: "Analytics run through Plausible, no cookies, no cross-site identifiers, no consent banner because there is nothing to consent to. Fonts ship from our own origin via next/font, so font-src stays locked to 'self' with no third-party font CDN in the trust surface.",
  },
  {
    icon: "file-check",
    title: "Responsible disclosure",
    body: "A machine-readable policy lives at /.well-known/security.txt (RFC 9116). Report anything you find to security@caisson.sh, we read it.",
  },
];

// A real, visible FAQ — drives the precise-scope honesty law (ADR-0080 §3). FAQPage JSON-LD is
// emitted only because these questions render on the page.
// GENERATED from the policy this site actually sends, never hand-written. A displayed `curl`
// transcript is a claim about live behaviour under ADR-0080, and hand-maintaining this block is
// exactly how it drifted from the real header twice. The builder is pinned to public/_headers by
// lib/security-headers.test.ts, so the page and the header cannot drift. One directive per line
// for readability; the real header is a single line.
const SHIPPED_CSP = `$ curl -sI https://caisson.sh | grep -i '^content-security-policy'
content-security-policy: ${CONTENT_SECURITY_POLICY.split("; ").join(";\n  ")}`;

export default function SecurityPage() {
  const jsonLd = [
    breadcrumb([
      { name: "Home", path: "/" },
      { name: "Security", path: "/security" },
    ]),
    techArticle({
      headline: "Caisson security & trust posture",
      description: SECURITY_META_DESCRIPTION,
      url: "https://caisson.sh/security",
    }),
    faqPage(SECURITY_FAQ),
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
          lede="The same posture Caisson generates for your app governs this site: deny by default, prove it with code, claim nothing we do not ship. Caisson generates audit evidence, it is not the auditor."
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
          title="The security your app inherits on day one."
          lede="These are product features, wired and tested into the codebase Caisson generates, not services we run on your behalf. You own the source and the evidence."
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
          title="How caisson.sh itself is secured."
          lede="A static site keeps the attack surface small, and we document exactly what ships."
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
          title="The policy that ships, including what is not yet locked down."
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
                exactly one third party: Plausible, for cookieless analytics.
                Nothing wider. Tightening the inline residual to per-script
                hashes is a tracked follow-up, not a shipped claim.
              </p>
            </Card>
          </div>
        </Section>

        {/* ===== The honesty boundary ===== */}
        <Section title="Caisson generates evidence. It is not an auditor.">
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
                We never imply Caisson is SOC 2 or HIPAA certified. A codebase
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
        <Section band="tint" title="The questions procurement asks first.">
          {/* Bare <Faq>, matching ai-kit/compliance — a Card wrapper here double-borders the
           * accordion rows (Faq draws its own per-row surface). D8(a) vetoable call. */}
          <Faq
            items={SECURITY_FAQ}
            style={{ marginTop: "var(--cs-space-8)" }}
          />
        </Section>

        {/* ===== Disclosure CTA ===== */}
        <Section
          title="Found something? Tell us."
          lede="We publish a machine-readable policy and read every report. No bounty program yet, the report still matters."
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
