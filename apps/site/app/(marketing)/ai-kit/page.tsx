import Link from "next/link";
import { buildMetadata } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { BUNDLE_MARKS, moduleMark } from "@/lib/marks";
import {
  bundlePrice,
  formatUsd,
  MODULE_PRICES,
  priceById,
} from "@/lib/pricing";
import {
  Button,
  Card,
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
import { AddToCartButton } from "@/components/add-to-cart-button";
import { MediaPlaceholder } from "@/components/media-placeholder";
import { bundleCatalogItem, toCartItem } from "@/lib/catalog";
import { TrackView } from "@/components/track-view";

const AI_KIT_DESCRIPTION = `A metered infer()/embed() gateway on Vercel AI SDK v5: Postgres-atomic token metering with a per-tenant circuit breaker, typed input/output guardrails, and versioned prompts, composed behind one chokepoint. ${bundlePrice("ai-production")} once, own the source.`;

export const metadata = buildMetadata({
  title: "AI Production Kit",
  description: AI_KIT_DESCRIPTION,
  path: "/ai-kit",
});

// Price from the canonical pricing table.
const modulePrice = priceById("module");

// Cart-ready CatalogItem for the peak-intent buy CTAs below (ADR-0192 single add-to-cart buy-verb).
const _catalogItem = bundleCatalogItem("ai-production");
const bundleCartItem = _catalogItem ? toCartItem(_catalogItem) : undefined;

// FAQ items — answer-first (ADR-0080 §6); also rendered as faqPage JSON-LD. Record: edition-ai-kit.json.
const FAQ_ITEMS = [
  {
    question: "What does token metering actually prevent?",
    answer:
      "A runaway loop, a misconfigured agent, or a single burst of traffic can multiply your API invoice by 10x before you see it. Usage writes in the same Postgres transaction as the result (an atomic increment), so concurrent calls can never double-count or drop a charge. Crossing the cap opens the circuit breaker and returns HTTP 402 before the next model call fires.",
  },
  {
    question: "What happens when a tenant hits their spend cap?",
    answer:
      "The breaker opens. The next model call returns HTTP 402 with a structured error body, the same as any other payment-required response in your API. The window resets on the configured interval. No partial responses, no silent overages.",
  },
  {
    question: "Can I use my own provider key instead of the platform lane?",
    answer:
      "Yes. BYOK resolves a tenant's own encrypted provider key ahead of the shared lane, written through the same per-tenant field-crypto boundary the rest of the platform uses. A BYOK-backed call debits zero credits, since the tenant is paying the model provider directly.",
  },
] as const;

// Base substrate predates the F6 sellable-module mark set — ai-config never got a standalone SKU or
// a bespoke mark, so it resolves through this local map (matches the compliance/agentic-dev pages'
// same-shaped exception). Sellable members resolve via `moduleMark`.
const BASE_MEMBER_ICON: Record<string, IconName> = {
  "ai-config": "gauge",
};

// The bundle's real composed packages (record: edition-ai-kit.json memberModules) — icon + name +
// one-liner, priced via a StatusChip when the package is also sold standalone (`MODULE_PRICES`),
// linking to its module depth page; ai-config is base substrate and renders unpriced.
const MEMBER_MODULES: readonly {
  id: string;
  name: string;
  oneLiner: string;
}[] = [
  {
    id: "prompt-registry",
    name: "Prompt registry",
    oneLiner:
      "Versioned prompts with rollout history: promote or roll back a prompt by moving an alias pointer, no redeploy required.",
  },
  {
    id: "ai-meter",
    name: "Token metering",
    oneLiner:
      "PG-atomic token metering with per-tenant spend caps and a circuit breaker: a runaway prompt loop trips the breaker before it runs your bill up.",
  },
  {
    id: "guardrails",
    name: "Guardrails",
    oneLiner:
      "Input and output guardrails wired once, at the model boundary, instead of copy-pasted into every call site.",
  },
  {
    id: "ai-config",
    name: "AI config",
    oneLiner:
      "Provider-agnostic config resolver plus a buyer settings file: the lane-to-provider mapping infer() reads to pick a model. Base substrate, composed in at no separate module price.",
  },
];

function MemberModuleCard({
  id,
  name,
  oneLiner,
}: {
  id: string;
  name: string;
  oneLiner: string;
}) {
  const price = MODULE_PRICES.find((m) => m.id === id);
  const icon = BASE_MEMBER_ICON[id] ?? moduleMark(id);
  const card = (
    <Card interactive={price !== undefined}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--cs-space-3)",
        }}
      >
        <Icon name={icon} size="lg" />
        <span className="cs-card-title">{name}</span>
      </div>
      <p className="cs-muted" style={{ marginTop: "var(--cs-space-3)" }}>
        {oneLiner}
      </p>
      {price && (
        <div style={{ marginTop: "var(--cs-space-4)" }}>
          <StatusChip label={formatUsd(price.amount)} tone="muted" />
        </div>
      )}
    </Card>
  );
  return price ? (
    <Link
      href={`/marketplace/modules/${id}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      {card}
    </Link>
  ) : (
    card
  );
}

// Hero artifact — the reserve-before / reconcile-after chokepoint every infer()/embed() call
// crosses, ending in the real 402 spend-cap denial (member-true; replaces the eval-gate artifact
// the bundle never actually ships).
const HERO_ARTIFACT = (
  <Terminal
    label="POST /api/support-reply · infer()"
    status={<StatusChip label="402 spend cap" tone="accent" dot />}
  >
    {'> infer("support-reply", input)\n'}
    <span className="cs-tok-muted">
      {"  resolve prompt@v7 → guardrail(in) → reserve tokens against cap\n"}
    </span>
    {"\n"}
    <span className="cs-tok-danger">{"✗ 402 Payment Required"}</span>
    {"  tenant_9f2 crossed daily_tokens cap\n"}
    <span className="cs-tok-muted">
      {"  breaker: open · resets on window · zero calls reach the provider\n"}
    </span>
  </Terminal>
);

export default function AiKitPage() {
  // JSON-LD nodes
  const appNode = softwareApplication({
    name: "Caisson AI-Production",
    description: AI_KIT_DESCRIPTION,
    url: "https://caisson.sh/ai-kit",
    priceId: "ai-production",
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
      <TrackView item="bundle:ai-production" />
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

      {/* ===== Hero: one gateway between your code and the model ===== */}
      <Hero
        eyebrow="AI-Production bundle"
        title="One gateway between your code and the model."
        lede={
          <>
            infer() and embed() are the only door to a model in this kit: every
            call resolves a versioned prompt, reserves against a per-tenant
            spend cap, crosses a guardrail on the way in and out, and reconciles
            usage in the same Postgres transaction as the result. Vercel AI SDK
            v5 sits behind it; your route handler calls infer(lane, input) and
            never touches a provider SDK directly.
          </>
        }
        ctas={
          <>
            {bundleCartItem && (
              <AddToCartButton item={bundleCartItem} variant="primary" />
            )}
            <Button href="/docs/ai-kit" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        artifact={HERO_ARTIFACT}
      />

      {/* ===== What it composes ===== */}
      <Section
        eyebrow="What it composes"
        title="One package, four other Caisson packages behind it."
        lede="The kit is one package, @caisson/ai-kit, wired around four other Caisson packages: prompt-registry resolves and renders the versioned prompt, ai-meter reserves against the tenant's cap before the call and reconciles the real usage after, guardrails runs the input and output through a Zod-typed schema and policy check, and ai-config maps the call's lane to a provider. The pipeline is fixed and fail-closed (resolve, render, input-guard, reserve, provider call, record usage, output-guard, reconcile), and it is the only Caisson package that imports a provider SDK (ai / @ai-sdk/*), keeping that dependency behind one boundary instead of scattered across your route handlers."
        band="tint"
      />

      {/* ===== Media slot (ADR-0237 F2) ===== */}
      <Section>
        <MediaPlaceholder icon={BUNDLE_MARKS["ai-production"]} />
      </Section>

      {/* ===== Four composed modules ===== */}
      <Section
        eyebrow="What ships in the box"
        title="Four modules behind one chokepoint."
      >
        <Reveal>
          <FeatureGrid cols={2}>
            {MEMBER_MODULES.map((m) => (
              <MemberModuleCard key={m.id} {...m} />
            ))}
          </FeatureGrid>
        </Reveal>
      </Section>

      {/* ===== Who it's for ===== */}
      <Section
        eyebrow="Who it's for"
        title="Teams whose one fetch call is about to become a feature."
        lede="Teams that already have a route calling a model and have hit, or are about to hit, one of three failure modes: an unmetered retry loop triples the API invoice before anyone notices, a prompt edited inline three files deep breaks silently with no way to diff or roll it back, or user input reaches the model with no schema and no policy check on what comes back. If your AI feature is one fetch call today, this kit is the difference between that and a feature you can put a spend cap and an audit trail behind."
        band="surface"
      />

      {/* ===== Metered by construction, BYOK included ===== */}
      <Section
        eyebrow="Metered by construction"
        title="BYOK included."
        lede="The same reserve-before / reconcile-after chokepoint covers infer(), inferStream(), embed(), and embedMany(), so a runaway embedding job hits the same cap as a runaway chat loop. A tenant can also supply their own provider key instead of the shared platform lane; BYOK resolves the tenant's encrypted key ahead of the default, and a BYOK-backed call debits zero credits because the tenant pays the provider directly."
      />

      {/* ===== Rigor as code ===== */}
      <Section
        eyebrow="Rigor as code"
        title="Every claim here is a control you can point at."
        lede="The caps and the breaker are configuration checked into your repo, enforced at call time, and reviewable in the same pull request as the feature that needs them."
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
          <FeatureGrid cols={3}>
            <Card accent>
              <div className="cs-card-title">One-time license</div>
              <p
                className="cs-num"
                style={{
                  fontSize: "var(--cs-text-2xl)",
                  marginTop: "var(--cs-space-2)",
                }}
              >
                {bundlePrice("ai-production")}
              </p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                The gateway, all four composed modules, and future patch
                releases, in your own repo as TypeScript source. Scaffold it in
                with bunx @caisson-sh/cli@latest, or add it to an existing
                Caisson base.
              </p>
            </Card>

            <Card>
              <div className="cs-card-title">Per-module</div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                The composed modules are also sold individually: prompt-registry
                from $99, guardrails from $149, ai-meter from $199;
                {modulePrice && modulePrice.amount !== null ? (
                  <>
                    {" "}
                    the catalog floor is {modulePrice.from ? "from " : ""}
                    <span className="cs-num">
                      {formatUsd(modulePrice.amount)}
                    </span>
                  </>
                ) : null}
                .
              </p>
            </Card>

            <Card>
              <div className="cs-card-title">Developer plan</div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                $499/yr adds credits, framework updates, and private-registry
                pulls on top of any license you own.
              </p>
            </Card>
          </FeatureGrid>

          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            <Link href="/marketplace" style={{ color: "var(--cs-link)" }}>
              See the full lineup
            </Link>
            . Need regression evals in CI too? The eval harness is a separate
            standalone module:{" "}
            <Link
              href="/marketplace/modules/ai-evals"
              style={{ color: "var(--cs-link)" }}
            >
              see it on the marketplace
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
          {"$ bunx @caisson-sh/cli@latest\n"}
        </Terminal>
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            marginTop: "var(--cs-space-6)",
            flexWrap: "wrap",
          }}
        >
          {bundleCartItem && (
            <AddToCartButton item={bundleCartItem} variant="primary" />
          )}
          <Button href="/docs/ai-kit" variant="ghost">
            Read the docs
          </Button>
        </div>
      </Section>
    </>
  );
}
