import Link from "next/link";
import { buildMetadata } from "@/lib/metadata";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { moduleMark } from "@/lib/marks";
import { hasModulePage } from "@/lib/module-pages";
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
import { TrialPath } from "@/components/trial-path";
import { MediaCarousel } from "@/components/media-carousel";
import { mediaSlides } from "@/lib/media-manifest";
import { requireBundlePage, spellCount } from "@/lib/bundle-pages";
import { TrackView } from "@/components/track-view";

// Hero copy, member list, and FAQ read from the shared bundle content record (lib/bundle-pages.ts);
// the bespoke sections below stay page-local.
const record = requireBundlePage("ai-production");

export const metadata = buildMetadata({
  title: record.metaTitle,
  description: record.metaDescription,
  path: "/ai-kit",
});

// The gallery viewer for this bundle: its live demo, docs, and members in one place.
const GALLERY_HREF = "/marketplace?view=bundle:ai-production";

// FAQ items — answer-first (ADR-0080 §6); also rendered as faqPage JSON-LD. Read from the record.
const FAQ_ITEMS = record.faq;

// Base substrate predates the F6 sellable-module mark set — ai-config never got a standalone SKU or
// a bespoke mark, so it resolves through this local map (matches the compliance/agentic-dev pages'
// same-shaped exception). Sellable members resolve via `moduleMark`.
const BASE_MEMBER_ICON: Record<string, IconName> = {
  "ai-config": "gauge",
};

// The bundle's real composed packages — read from the shared bundle content record, linking to a
// member's module depth page when one exists.
const MEMBER_MODULES = record.members;

function MemberModuleCard({
  id,
  name,
  oneLiner,
}: {
  id: string;
  name: string;
  oneLiner: string;
}) {
  // Linkable is gated on the depth page actually existing — a Link to a missing one 404s (G5).
  const linkable = hasModulePage(id);
  const icon = BASE_MEMBER_ICON[id] ?? moduleMark(id);
  const card = (
    <Card interactive={linkable}>
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
    </Card>
  );
  return linkable ? (
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
    description: record.metaDescription,
    url: "https://caisson.sh/ai-kit",
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
        eyebrow={record.hero.eyebrow}
        title={record.hero.title}
        lede={record.hero.lede}
        ctas={
          <>
            <Button href={GALLERY_HREF} variant="primary">
              Run the live demo
            </Button>
            <Button href="/docs/ai-production" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        artifact={HERO_ARTIFACT}
      />

      {/* ===== What it composes ===== */}
      <Section
        title="One package, nine other Caisson packages behind it."
        lede="The AI-Production bundle composes @caisson-sh/ai-config, @caisson-sh/ai-meter, @caisson-sh/credits, @caisson-sh/field-crypto, @caisson-sh/guardrails, @caisson-sh/kernel, @caisson-sh/prompt-registry, @caisson-sh/tenancy-rls, and @caisson-sh/ai-evals. Together they resolve and render versioned prompts, map lanes to providers, validate inputs and outputs, reserve and reconcile integer credits, isolate tenant data, encrypt sensitive fields, and run the same eval checks in CI. The production safeguards stay in explicit package boundaries instead of being scattered through route handlers."
        band="tint"
      />

      {/* ===== Media slot (ADR-0237 F2) ===== */}
      <Section>
        <MediaCarousel
          slides={mediaSlides("bundle", "ai-production")}
          label="AI-Production bundle media"
        />
      </Section>

      {/* ===== Four composed modules ===== */}
      <Section
        title={`${spellCount(MEMBER_MODULES.length)} modules behind one chokepoint.`}
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
        title="Teams whose one fetch call is about to become a feature."
        lede="Teams that already have a route calling a model and have hit, or are about to hit, one of three failure modes: an unmetered retry loop triples the API invoice before anyone notices, a prompt edited inline three files deep breaks silently with no way to diff or roll it back, or user input reaches the model with no schema and no policy check on what comes back. If your AI feature is one fetch call today, this kit is the difference between that and a feature you can put a spend cap and an audit trail behind."
        band="surface"
      />

      {/* ===== Metered by construction, BYOK included ===== */}
      <Section
        title="BYOK included."
        lede="The same reserve-before / reconcile-after chokepoint covers infer(), inferStream(), embed(), and embedMany(), so a runaway embedding job hits the same cap as a runaway chat loop. A tenant can also supply their own provider key instead of the shared platform lane; BYOK resolves the tenant's encrypted key ahead of the default, and a BYOK-backed call debits zero credits because the tenant pays the provider directly."
      />

      {/* ===== Rigor as code ===== */}
      <Section
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
              "# caisson.ai.toml, checked into your repo, enforced at call time\n\n"
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

      {/* ===== How it ships ===== */}
      <Section title="How it ships.">
        <Reveal>
          <FeatureGrid cols={2}>
            <Card accent>
              <div className="cs-card-title">The whole gateway</div>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-3)" }}
              >
                The gateway and all{" "}
                {spellCount(MEMBER_MODULES.length).toLowerCase()} composed
                modules, in your own repo as TypeScript source. Scaffold it in
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
                The composed modules also work on their own: prompt registry,
                guardrails, and token metering each compose onto the base
                without the rest.
              </p>
            </Card>
          </FeatureGrid>

          <p className="cs-footnote" style={{ marginTop: "var(--cs-space-6)" }}>
            <Link href="/marketplace" className="cs-link">
              See the full lineup
            </Link>
            . Need regression evals in CI too? The eval harness is a separate
            standalone module:{" "}
            <Link href="/marketplace/modules/ai-evals" className="cs-link">
              see it on the marketplace
            </Link>
            .
          </p>
        </Reveal>
      </Section>

      {/* ===== FAQ ===== */}
      <Section title="Common questions" band="tint">
        <Reveal>
          <Faq items={FAQ_ITEMS} style={{ marginTop: "var(--cs-space-6)" }} />
        </Reveal>
      </Section>

      {/* ===== Prove fit in week one (ADR-0272 §3) ===== */}
      <Reveal>
        <Section
          title="Prove fit in week one."
          lede="Don't take the fit on faith, scaffold the audited base and run it on your own stack."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <TrialPath />
          </div>
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Section>
        <h2
          className="cs-section-title"
          style={{ marginTop: "var(--cs-space-3)" }}
        >
          Ship the feature with the brakes on.
        </h2>
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          Scaffold a new project with the AI Production Kit included, or add it
          to an existing Caisson base.
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
          <Button href={GALLERY_HREF} variant="primary">
            Run the live demo
          </Button>
          <Button href="/docs/ai-production" variant="ghost">
            Read the docs
          </Button>
        </div>
      </Section>
    </>
  );
}
