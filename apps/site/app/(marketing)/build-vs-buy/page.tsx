// Build vs buy — the honest earlier-layer decision page (program-spec row #5, named in ADR-0079 §2
// but never built). FRAME (ADR-0079 Rejected + S6, ADR-0040 firewall): an honest build-it /
// buy-a-platform / own-the-code decision page — NO head-to-head competitor table, NO kit-vs-kit
// matrix, NO competitor named. Register + copy laws: ADR-0080 (dev-kit-noun over platform-verb,
// technical-vs-administrative honesty boundary, answer-first blocks). Live posture: ADR-0237 rider
// 2 — every claim present-tense, nothing roadmap/coming-soon. Every number reads from lib/pricing
// (the committed sheet) so it can never drift; the $80k / 6–9-month build figures are the
// ADR-0080 §4 retrofit numbers already shipped on /compliance.
import { UpdatesForm } from "@/components/waitlist-form";
import {
  Button,
  Card,
  CodeBlock,
  CredentialStrip,
  Faq,
  FeatureGrid,
  Hero,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
} from "@/components";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  techArticle,
} from "@/lib/jsonld";
import { bundlePrice, formatPrice, priceById } from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Build vs buy compliance infrastructure",
  description:
    "Build vs buy for audit-ready infrastructure: build it yourself over months, rent a hosted audit platform, or own the code that enforces the controls. How Caisson fits as the earlier layer you buy once and keep.",
  path: "/build-vs-buy",
  type: "article",
});

// The compliance bundle price ($1,049 once) and the optional updates cadence ($1,499/yr) both read
// from the committed sheet (lib/pricing) — never hand-typed, so a reprice can't strand this page.
const COMPLIANCE_PRICE = bundlePrice("compliance");
const UPDATES = priceById("compliance-updates");
const UPDATES_PRICE = UPDATES ? formatPrice(UPDATES) : "—";

// The three honest paths — narrative cards, NOT a tick-matrix racing a competitor (ADR-0040
// firewall). The "buy a platform" path describes the CATEGORY (a hosted audit-automation service)
// generically; it never names a vendor or fabricates a competitor price.
const PATHS = [
  {
    icon: "git-branch" as const,
    kicker: "Path 1",
    title: "Build it yourself",
    body: "Write fail-closed RLS, a tamper-evident audit chain, WORM evidence storage, and an evidence-pack generator from scratch — the load-bearing parts a regulated-SaaS team has to get exactly right the first time.",
    figure: "SOC 2 from scratch: $80k, 6–9 months",
    note: "Retrofitting RLS, WORM, and an audit chain into a live database is months more.",
  },
  {
    icon: "gauge" as const,
    kicker: "Path 2",
    title: "Buy a hosted platform",
    body: "Subscribe to an audit-automation service that connects to your stack and monitors it from the outside — a scanner and a dashboard. Fast to show a status page, and a recurring subscription for as long as you need to stay audit-ready.",
    figure: "A scanner reports what's missing.",
    note: "It watches code it didn't write — the controls still have to exist in your codebase.",
  },
  {
    icon: "boxes" as const,
    kicker: "Path 3 · Caisson",
    title: "Own the code",
    body: "The compliance controls as source you own — fail-closed RLS, an append-only audit chain, WORM evidence storage, and an evidence-pack generator — wired on day one and tested in CI on every push.",
    figure: `${COMPLIANCE_PRICE} · one-time, perpetual`,
    note: "Own the source. No per-seat subscription; optional updates keep the mappings current.",
  },
] as const;

// Code-as-proof (ADR-0080 §2): the controls you'd otherwise build or rent, running as source you own.
function ProofTerminal() {
  return (
    <Terminal
      label="base substrate · RLS + audit chain"
      status={<StatusChip label="CI-tested" tone="success" dot />}
    >
      {`-- fail-closed RLS: a query with\n`}
      {`-- no tenant context returns nothing\n`}
      {`> SELECT count(*)\n`}
      {`  FROM audit_events;\n`}
      <span className="cs-tok-accent">{` 0\n`}</span>
      {`\n`}
      {`// kernel verifyChain —\n`}
      {`// tamper breaks the link\n`}
      {`const r = verifyChain(\n`}
      {`  entries, anchor\n`}
      {`);\n`}
      {`// `}
      <span className="cs-tok-success">
        {`{ valid: true,\n`}
        {`  brokenAt: null }`}
      </span>
    </Terminal>
  );
}

// Real FAQ (answer-first, 40–60-word openings — ADR-0080 §6). Rendered visibly AND emitted as
// FAQPage JSON-LD for AI retrieval (ADR-0079 §4, only where a real FAQ exists).
const FAQ = [
  {
    question: "Is Caisson a compliance platform?",
    answer:
      "No. Caisson is a codebase you own, not a hosted service that watches your stack. It ships the technical controls a framework requires — fail-closed RLS, an audit chain, WORM storage, evidence generation — as source you run yourself. It generates audit evidence; it does not certify you or replace your auditor.",
  },
  {
    question: "If I own the code, do I still need an audit?",
    answer:
      "Yes. Caisson ships the technical controls; the audit itself and your organizational controls — HR, vendor management, incident response — stay yours. No codebase can make you SOC 2 or HIPAA compliant. Caisson makes the technical evidence real, testable, and ready before the assessor asks for it.",
  },
  {
    question: "Build vs buy — which is cheaper?",
    answer: `Building the controls yourself runs $80k and 6–9 months for SOC 2 alone. A hosted platform is a recurring subscription that never ends. Owning the Compliance bundle source is ${COMPLIANCE_PRICE}, once — the controls are wired on day one, and an optional updates plan keeps framework mappings current if you want it.`,
  },
  {
    question: "What happens if I stop paying?",
    answer: `Nothing you own goes away. The Compliance bundle is a one-time, perpetual purchase — the source and every control you bought stay yours. Only the optional Compliance Updates plan (${UPDATES_PRICE}) lapses, which means you stop receiving refreshed framework mappings, not that your code stops working.`,
  },
] as const;

// JSON-LD: TechArticle + BreadcrumbList + FAQPage.
const articleLd = techArticle({
  headline: "Build vs buy: compliance infrastructure you own",
  description:
    "The honest build-it / buy-a-platform / own-the-code decision for audit-ready infrastructure, and where Caisson fits as the earlier layer.",
  url: `${SITE_URL}/build-vs-buy`,
});
const breadcrumbLd = breadcrumb([
  { name: "Home", path: "/" },
  { name: "Build vs buy", path: "/build-vs-buy" },
]);
const faqLd = faqPage(FAQ);

export default function BuildVsBuyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }}
      />

      {/* ===== Hero — answer-first lede (ADR-0079 §5, 40–60 words) ===== */}
      <Hero
        eyebrow="Build vs buy · Compliance infrastructure"
        title="Build it, buy it, or own it."
        lede={
          <>
            Three ways to get audit-ready infrastructure: build it yourself over
            6–9 months, rent a hosted audit platform that watches your stack
            from the outside, or own the code that enforces the controls from
            within. Caisson is the third path — the load-bearing layer, bought
            once and yours to keep.
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
            items={[
              "Own the source",
              `${COMPLIANCE_PRICE} · one-time`,
              "No per-seat subscription",
              "Tested in CI",
            ]}
            note="Caisson ships technical controls — the audit stays yours"
          />
        }
        artifact={<ProofTerminal />}
      />

      {/* ===== The three paths ===== */}
      <Section
        eyebrow="Three honest paths"
        title="Every regulated team weighs the same three."
        lede="This isn't a scoreboard against a named vendor — it's the real decision. Build the load-bearing infrastructure, rent a service that monitors it, or own the code that is it. Here's each path told straight."
      >
        <FeatureGrid cols={3} style={{ marginTop: "var(--cs-space-8)" }}>
          {PATHS.map((p) => (
            <Card key={p.title} accent={p.kicker.includes("Caisson")}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--cs-space-3)",
                  marginBottom: "var(--cs-space-4)",
                }}
              >
                <Icon name={p.icon} size="lg" aria-hidden />
                <StatusChip
                  label={p.kicker}
                  tone={p.kicker.includes("Caisson") ? "accent" : "muted"}
                />
              </div>
              <h3
                className="cs-card-title"
                style={{ marginBottom: "var(--cs-space-3)" }}
              >
                {p.title}
              </h3>
              <p
                className="cs-muted"
                style={{ marginBottom: "var(--cs-space-4)" }}
              >
                {p.body}
              </p>
              <p
                className="cs-num"
                style={{
                  fontSize: "var(--cs-text-lg)",
                  marginBottom: "var(--cs-space-2)",
                }}
              >
                {p.figure}
              </p>
              <p className="cs-footnote">{p.note}</p>
            </Card>
          ))}
        </FeatureGrid>
        <p className="cs-footnote" style={{ marginTop: "var(--cs-space-5)" }}>
          Build figures are the industry cost of a first SOC 2, not a Caisson
          quote. Whether any path makes your system compliant depends on your
          deployment and your audit — a determination that stays with your team.
        </p>
      </Section>

      {/* ===== Earlier-layer thesis + proof ===== */}
      <Reveal>
        <Section
          eyebrow="The earlier layer"
          title="A scanner reports what's missing. It doesn't build it."
          lede="A hosted platform inspects your stack from the outside and tells you where the controls should be. Caisson is the controls — fail-closed RLS, a tamper-evident audit chain, and evidence generation, as source you own and run. The load-bearing layer sits earlier than the dashboard that grades it."
          band="tint"
        >
          <div style={{ marginTop: "var(--cs-space-8)" }}>
            <CodeBlock
              label="What you own instead of rent: controls as source"
              frame
              status={<StatusChip label="artifact" tone="accent" dot />}
              code={`// The controls a platform checks for — as code you own.
import { verifyChain } from "@caisson/kernel";

// Append-only SHA-256 chain: tamper, truncate, or reorder
// any row and the next link fails on verify.
const result = verifyChain(entries, anchor);
// { valid: true, brokenAt: null }

// Fail-closed RLS is enforced by Postgres itself — a query
// that never sets the tenant context matches no rows, not
// a leaked row. No dashboard required to make it true.`}
            />
          </div>
          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-5)" }}>
            The base substrate — fail-closed RLS, auth, billing — is Apache-2.0
            and ships with every bundle. The Compliance bundle adds the WORM
            store, audit chain, and evidence-pack generator on top.
          </p>
        </Section>
      </Reveal>

      {/* ===== Own vs rent + the honesty boundary (ADR-0080 §3, non-negotiable) ===== */}
      <Reveal>
        <Section eyebrow="Own it, don't rent it">
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
                    color: "var(--cs-accent)",
                    marginBottom: "var(--cs-space-3)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  What Caisson ships
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
                    "Fail-closed RLS, WORM storage, and an append-only audit chain, as source you own",
                    "An evidence-pack generator that maps controls to framework clauses",
                    "The gates wired and tested in CI before your first assessment",
                    `A one-time, perpetual purchase — ${COMPLIANCE_PRICE} for the Compliance bundle`,
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
                    "The audit itself and the conformity sign-off",
                    "Organizational controls: HR, vendor management, incident response",
                    "Which frameworks apply and how your systems are scoped",
                    "The decision to keep the optional updates plan, or not",
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
            Caisson ships technical controls and generates evidence. It is not
            itself SOC 2 or HIPAA certified, and owning it does not make you
            compliant — that determination depends on your audit and your
            organizational controls.
          </p>
        </Section>
      </Reveal>

      {/* ===== Cost over time ===== */}
      <Reveal>
        <Section
          eyebrow="Cost over time"
          title="Buy the code once. Keep it."
          band="surface"
        >
          <Card>
            <p
              style={{
                fontSize: "var(--cs-text-xl)",
                lineHeight: "var(--cs-leading-relaxed)",
                letterSpacing: "var(--cs-tracking-tight)",
                maxWidth: "56ch",
              }}
            >
              A hosted platform is a subscription that renews for as long as you
              need to stay audit-ready. Building the same controls yourself
              costs <span className="cs-num">$80k</span> and{" "}
              <span className="cs-num">6–9 months</span> for a first SOC 2. The
              Compliance bundle is{" "}
              <span className="cs-num">{COMPLIANCE_PRICE}</span>, once.
            </p>
            <p
              className="cs-muted"
              style={{ marginTop: "var(--cs-space-4)", maxWidth: "60ch" }}
            >
              Regulations don't hold still, so an optional Compliance Updates
              plan ({UPDATES_PRICE}) keeps the control mappings and evidence
              packs current. It's an add-on, not a gate: the source you bought
              runs whether or not you renew.
            </p>
          </Card>
        </Section>
      </Reveal>

      {/* ===== FAQ ===== */}
      <Reveal>
        <Section eyebrow="Common questions" title="Build vs buy, answered.">
          <Faq items={FAQ} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Section eyebrow="Get started" id="get-started">
        <h2 className="cs-section-title">Own the controls from day one.</h2>
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          Scaffold a project and the fail-closed RLS, audit chain, and evidence
          generator are in the repo, tested, before your first customer signs.
        </p>
        <div style={{ marginBottom: "var(--cs-space-5)" }}>
          <Terminal label="scaffold a Caisson project">
            bunx @caisson-sh/cli@latest
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
        <div style={{ marginTop: "var(--cs-space-6)" }}>
          <UpdatesForm source="build-vs-buy" />
        </div>
      </Section>
    </>
  );
}
