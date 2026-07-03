import Link from "next/link";
import { buildMetadata } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { formatPrice, priceById } from "@/lib/pricing";
import {
  Button,
  Card,
  Faq,
  Hero,
  Icon,
  Reveal,
  Section,
  StatusChip,
  Terminal,
} from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { editionCatalogItem, toCartItem } from "@/lib/catalog";

export const metadata = buildMetadata({
  title: "AI Production Kit",
  description:
    "Token metering wired Postgres-atomic, a per-tenant spend cap with a circuit breaker, and an eval harness that blocks the deploy on regression. The production-rigor layer cheap AI boilerplate skips.",
  path: "/ai-kit",
});

// Price from the canonical pricing table.
const aiKitPrice = priceById("ai-kit");
const modulePrice = priceById("module");

// Cart-ready CatalogItem for the peak-intent buy CTAs below (ADR-0192 single add-to-cart buy-verb).
const _catalogItem = editionCatalogItem("ai-kit");
const editionCartItem = _catalogItem ? toCartItem(_catalogItem) : undefined;

// FAQ items — answer-first (ADR-0080 §6); also rendered as faqPage JSON-LD.
const FAQ_ITEMS = [
  {
    question: "What does token metering actually prevent?",
    answer:
      "A runaway loop, a misconfigured agent, or a single burst of traffic can multiply your API invoice by 10× before you see it. Caisson writes usage in the same Postgres transaction as the result — an atomic increment — so concurrent calls can never double-count or drop a charge. Crossing the cap opens the circuit breaker and returns HTTP 402 before the next model call fires.",
  },
  {
    question: "What happens when a tenant hits their spend cap?",
    answer:
      "The breaker opens. The next model call returns HTTP 402 with a structured error body — the same as any other payment-required response in your API. The window resets on the configured interval (UTC midnight by default). No partial responses, no silent overages, no surprise invoice.",
  },
  {
    question: "How does the eval gate work in CI?",
    answer:
      "You commit a golden set of prompt → expected-output pairs alongside your prompt definitions. On every pull request, the eval runner scores the current prompts against the golden set. A score drop past the configured tolerance fails the check — the regression never merges. The gate is a GitHub Actions step; it reads from the prompt registry and writes results to a structured report.",
  },
  {
    question: "Is Caisson an AI platform or a library?",
    answer:
      "A library — a codebase you own. It ships as typed TypeScript packages you install and configure in your own repository. There is no hosted control plane, no SDK that phones home, no vendor lock-in beyond the Postgres database you already run.",
  },
] as const;

// Illustrative CI terminal — shows the eval-gate design: a score regression
// blocks the deploy. This is a design artifact, not a runnable CLI command.
const CI_ARTIFACT = (
  <Terminal
    label="illustrative · ci / eval-gate"
    status={<StatusChip label="BLOCKED" tone="accent" dot />}
  >
    {"$ caisson eval run --suite prompts/golden.yaml --ci\n"}
    {"Running 24 cases against golden set...\n\n"}
    {"  "}
    <span className="cs-tok-muted">case</span>
    {"  helpfulness     score "}
    <span className="cs-tok-success">0.91</span>
    {"  prev "}
    <span className="cs-tok-success">0.93</span>
    {"  Δ -0.02  ok\n"}
    {"  "}
    <span className="cs-tok-muted">case</span>
    {"  accuracy        score "}
    <span className="cs-tok-danger">0.72</span>
    {"  prev "}
    <span className="cs-tok-success">0.91</span>
    {"  Δ -0.19  "}
    <span className="cs-tok-danger">FAIL</span>
    {"\n"}
    {"  "}
    <span className="cs-tok-muted">case</span>
    {"  refusal_rate    score "}
    <span className="cs-tok-success">0.98</span>
    {"  prev "}
    <span className="cs-tok-success">0.97</span>
    {"  Δ +0.01  ok\n\n"}
    <span className="cs-tok-danger">✗ eval gate failed</span>
    {" — accuracy regressed "}
    <span className="cs-tok-danger">0.19</span>
    {" > tolerance "}
    <span className="cs-tok-accent">0.02\n</span>
    {"  deploy blocked. fix the prompt or update the golden set.\n"}
    {"  report: .caisson/eval/2026-06-27T14-09-11Z.json\n"}
  </Terminal>
);

export default function AiKitPage() {
  const price = aiKitPrice;

  // JSON-LD nodes
  const appNode = softwareApplication({
    name: "Caisson AI Production Kit",
    description:
      "Token metering wired Postgres-atomic, a per-tenant spend cap with a circuit breaker, and an eval harness that blocks the deploy on regression.",
    url: "https://caisson.sh/ai-kit",
    priceId: "ai-kit",
  });

  const crumbNode = breadcrumb([
    { name: "Home", path: "/" },
    { name: "AI Production Kit", path: "/ai-kit" },
  ]);

  const faqNode = faqPage(
    FAQ_ITEMS.map((f) => ({ question: f.question, answer: f.answer })),
  );

  return (
    <>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(appNode) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(crumbNode) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqNode) }}
      />

      {/* ===== Hero: the controls cheap AI boilerplate skips ===== */}
      <Hero
        eyebrow="AI Production Kit · Edition #2"
        title="The controls cheap AI skips."
        lede={
          <>
            A starter that calls the model is a demo. Metered token accounting,
            a per-tenant circuit breaker, an eval gate in CI, and typed
            guardrails are the gap between a demo and a feature you can charge
            for. This kit is that gap, wired and tested.
          </>
        }
        ctas={
          <>
            {editionCartItem && (
              <AddToCartButton item={editionCartItem} variant="primary" />
            )}
            <Button href="/docs/ai-kit" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        artifact={CI_ARTIFACT}
      />

      {/* ===== The named failure mode ===== */}
      <Section
        eyebrow="The failure mode"
        title="Cheap AI boilerplate ships the demo, not the controls."
        lede="Three ways an AI feature turns into an incident: an unmetered loop triples the invoice, an eval regression ships on Friday, a prompt nobody can audit breaks in production. This kit puts a named control in front of each one."
        band="tint"
      />

      {/* ===== Six controls ===== */}
      <Section eyebrow="What ships in the box" title="Six controls. One kit.">
        <Reveal>
          <div
            className="cs-grid cs-grid--3"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            <Card>
              <Icon name="gauge" size="lg" aria-label="Token metering" />
              <div
                className="cs-card-title"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Token metering
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Usage writes in the same Postgres transaction as the result —
                one atomic increment. Concurrent calls never double-count a
                charge or drop one under load.
              </p>
            </Card>

            <Card>
              <Icon name="wallet" size="lg" aria-label="Spend caps" />
              <div
                className="cs-card-title"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Spend caps + circuit breaker
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Each tenant gets a hard cap. Cross it and the breaker opens —
                the next model call returns HTTP 402 and resets on the window,
                not a surprise invoice.
              </p>
            </Card>

            <Card>
              <Icon name="cpu" size="lg" aria-label="Eval harness" />
              <div
                className="cs-card-title"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Eval harness in CI
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Prompts run against a golden set on every pull request. A score
                drop past tolerance fails the check — the regression never
                reaches a customer.
              </p>
            </Card>

            <Card>
              <Icon name="shield" size="lg" aria-label="Guardrails" />
              <div
                className="cs-card-title"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Guardrails
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Input and output cross a Zod-typed schema and a policy check on
                both sides of the model. Out-of-policy responses are rejected at
                the boundary, not forwarded.
              </p>
            </Card>

            <Card>
              <Icon name="git-branch" size="lg" aria-label="Prompt registry" />
              <div
                className="cs-card-title"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Prompt registry
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Every prompt is versioned and addressable by id. A call
                references <code className="mono">prompt@v7</code>, not an
                inline string — diff it, roll it back, audit what the model was
                asked.
              </p>
            </Card>

            <Card>
              <Icon name="server" size="lg" aria-label="Agent setup" />
              <div
                className="cs-card-title"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Typed agent setup
              </div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Typed agent and tool definitions with a per-tool allowlist. An
                agent calls only the tools its manifest declares — no implicit
                access, no surprise side-effect.
              </p>
            </Card>
          </div>
        </Reveal>
      </Section>

      {/* ===== Rigor as code ===== */}
      <Section
        eyebrow="Rigor, not theater"
        title="Every claim here is a control you can point at."
        lede="The caps, the breaker, and the eval gate are configuration checked into your repo and enforced at call time — not a dashboard you hope someone is watching."
        band="surface"
      >
        <Reveal delay={100}>
          <Terminal
            label="caisson.ai.toml"
            status={<StatusChip label="enforced at call time" tone="muted" />}
          >
            {
              "# caisson.ai.toml — checked into your repo, enforced at call time\n\n"
            }
            <span className="cs-tok-muted">{"[caps.default]\n"}</span>
            {"daily_tokens = "}
            <span className="cs-tok-accent">{"1_000_000\n"}</span>
            {"on_exceed    = "}
            <span className="cs-tok-danger">{'"break"'}</span>
            <span className="cs-tok-muted">
              {"   # open the circuit, return 402\n"}
            </span>
            {"\n"}
            <span className="cs-tok-muted">{"[evals]\n"}</span>
            {"gate      = "}
            <span className="cs-tok-accent">{'"ci"'}</span>
            <span className="cs-tok-muted">
              {"        # block the PR on regression\n"}
            </span>
            {"tolerance = "}
            <span className="cs-tok-accent">{"0.02"}</span>
            <span className="cs-tok-muted">
              {"      # max score drop before the check fails\n"}
            </span>
            {"\n"}
            <span className="cs-tok-muted">{"[guardrails]\n"}</span>
            {"input_schema  = "}
            <span className="cs-tok-accent">
              {'"schemas/chat-input.json"\n'}
            </span>
            {"output_policy = "}
            <span className="cs-tok-accent">
              {'"policies/content-policy.ts"\n'}
            </span>
          </Terminal>
        </Reveal>
      </Section>

      {/* ===== Pricing ===== */}
      <Section eyebrow={"How it's sold"} title="Own the code, or subscribe.">
        <Reveal>
          <div
            className="cs-grid cs-grid--3"
            style={{ marginTop: "var(--cs-space-8)" }}
          >
            <Card accent>
              <div className="cs-card-title">One-time license</div>
              {price && price.amount !== null && (
                <p
                  className="cs-num"
                  style={{
                    fontSize: "var(--cs-text-2xl)",
                    marginTop: "var(--cs-space-2)",
                  }}
                >
                  {formatPrice(price)}
                </p>
              )}
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Own the AI Production Kit source outright — the six controls,
                wired and tested, plus all future patch releases.
              </p>
            </Card>

            <Card>
              <div className="cs-card-title">Per-module</div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Take metering, caps, or the eval harness on its own — from{" "}
                {modulePrice ? (
                  <span className="cs-num">{formatPrice(modulePrice)}</span>
                ) : null}{" "}
                per module.
              </p>
            </Card>

            <Card>
              <div className="cs-card-title">Developer plan</div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                Subscription — credits, framework updates, and private-registry
                pulls. Keeps the kit current as model APIs shift.
              </p>
            </Card>
          </div>

          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            <Link href="/marketplace" style={{ color: "var(--cs-link)" }}>
              See the full lineup
            </Link>
            .
          </p>
        </Reveal>
      </Section>

      {/* ===== FAQ ===== */}
      <Section eyebrow="Common questions" band="tint">
        <Reveal>
          <Faq items={FAQ_ITEMS} style={{ marginTop: "var(--cs-space-6)" }} />
        </Reveal>
      </Section>

      {/* ===== Get started ===== */}
      <Section eyebrow="Get started">
        <h2
          className="cs-section-title"
          style={{ marginTop: "var(--cs-space-3)" }}
        >
          Ship the feature with the brakes on.
        </h2>
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          Scaffold a new project with the AI Production Kit included, or go
          straight to pricing to add it to an existing Caisson base.
        </p>
        <Terminal
          label="terminal"
          status={<StatusChip label="ready" tone="success" dot />}
        >
          {"$ npx create-caisson@latest\n"}
        </Terminal>
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            marginTop: "var(--cs-space-6)",
            flexWrap: "wrap",
          }}
        >
          {editionCartItem && (
            <AddToCartButton item={editionCartItem} variant="primary" />
          )}
          <Button href="/docs/ai-kit" variant="ghost">
            Read the docs
          </Button>
        </div>
      </Section>
    </>
  );
}
