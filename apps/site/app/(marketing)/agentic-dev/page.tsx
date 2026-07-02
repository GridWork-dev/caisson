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
} from "@/components";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { editionCatalogItem, toCartItem } from "@/lib/catalog";
import { breadcrumb, serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import { formatPrice, priceById } from "@/lib/pricing";

export const metadata = buildMetadata({
  title: "Agentic-Dev",
  description:
    "A governed-agent kernel for TypeScript codebases: typed agent/skill/rule schema, a guarded lifecycle state machine, local hybrid memory, and a hooks dispatcher. Own the source.",
  path: "/agentic-dev",
});

const agenticDevPrice = priceById("agentic-dev");

// Cart-ready CatalogItem for the peak-intent buy CTAs below (ADR-0192 single add-to-cart buy-verb).
const _catalogItem = editionCatalogItem("agentic-dev");
const editionCartItem = _catalogItem ? toCartItem(_catalogItem) : undefined;

/* ---------- Kernel pieces ---------- */
const PIECES = [
  {
    icon: "boxes" as const,
    label: "Typed agent / skill / rule schema",
    body: "Every agent, skill, and rule is a declared file — model lane, allowed tools, capability, side-effect flag. Validated against a schema at load. No agent grants itself a tool it did not declare.",
  },
  {
    icon: "git-branch" as const,
    label: "Lifecycle state machine",
    body: "Work moves SPEC → PLAN → EXECUTE → VERIFY → SWEEP → SHIP. Transitions are guarded: VERIFY fails, the machine reopens PLAN — there is no edge to SHIP. The path is the policy.",
  },
  {
    icon: "database" as const,
    label: "Local hybrid memory",
    body: "Recall is vector + full-text over a local store, scoped per project. Reads are always allowed; writes honor a per-session mode. Secrets are never a memory item — they source from env, not recall.",
  },
  {
    icon: "terminal" as const,
    label: "Hooks dispatcher",
    body: "Lifecycle events fire typed hooks — session-start recall, per-act logging, pre-commit gates. The dispatcher is the one audited seam; a hook cannot reach a credential the kernel did not hand it.",
  },
] as const;

/* ---------- FAQ (AI retrieval; also visible on page) ---------- */
const FAQS = [
  {
    question: "What does the governed-agent kernel actually enforce?",
    answer:
      "The kernel validates each agent declaration against a schema at load time, holds all credentials, and owns the lifecycle state machine — so an agent that wants to deploy cannot. That capability lives on one audited side of the seam.",
  },
  {
    question: "How do I buy Agentic-Dev?",
    answer:
      "Buy the edition outright for a perpetual license, or take just the kernel à la carte onto your existing Caisson base. Either way you own the source — fork it, ship it, keep it.",
  },
  {
    question: "Can I take just the kernel without the full edition?",
    answer:
      "Yes — per-module licensing is planned. You can pull the kernel à la carte onto the audited Caisson base.",
  },
];

/* ---------- Hero artifact ---------- */
const AgentDeclaration = (
  <Terminal
    label="agents/db-migrator.agent.yaml"
    status={<StatusChip label="schema-validated" tone="muted" dot />}
  >
    {`name:         db-migrator
capability:   code_write
model:        `}
    <span className="cs-tok-accent">sonnet</span>
    {`         # a lane, not a default to the top tier
tools:        [read, edit, run-tests]
side_effects: `}
    <span className="cs-tok-danger">false</span>
    {`          # cannot push, deploy, or read a secret
gate:         `}
    <span className="cs-tok-success">human-approval</span>
    {`  # data-migration tag → operator re-entry`}
  </Terminal>
);

export default function AgenticDevPage() {
  const appLd = softwareApplication({
    name: "Caisson Agentic-Dev",
    description:
      "A governed-agent kernel: typed agent/skill/rule schema, guarded lifecycle state machine, local hybrid memory, and a hooks dispatcher. Own the source.",
    url: `${SITE_URL}/agentic-dev`,
    priceId: "agentic-dev",
  });

  const bcLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Agentic-Dev", path: "/agentic-dev" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(appLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(bcLd) }}
      />

      {/* ===== Hero ===== */}
      <Hero
        eyebrow="Agentic-Dev edition"
        title="A governed-agent kernel."
        lede={
          <>
            Agents that declare their model lane, their tools, and their blast
            radius up front — and a lifecycle that refuses to ship work that did
            not pass verify. The boundary is written down, not assumed.
          </>
        }
        ctas={
          <>
            {editionCartItem && (
              <AddToCartButton item={editionCartItem} variant="primary" />
            )}
            <Button href="/docs/agentic-dev" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={
          <StatusChip
            tone="accent"
            label={
              agenticDevPrice
                ? `Own the source · ${formatPrice(agenticDevPrice)}`
                : "Own the source"
            }
            dot
          />
        }
        artifact={AgentDeclaration}
      />

      {/* ===== The four kernel pieces ===== */}
      <Reveal>
        <Section
          eyebrow="What the kernel is made of"
          title="Four parts, each a declared seam."
          lede="No part is a black box. Each is a file you can read, diff, and gate in review before an agent ever runs."
          band="tint"
        >
          <FeatureGrid cols={2}>
            {PIECES.map((p) => (
              <Card key={p.label}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cs-space-3)",
                    marginBottom: "var(--cs-space-3)",
                  }}
                >
                  <Icon name={p.icon} size="md" aria-label={p.label} />
                  <span className="cs-card-title">{p.label}</span>
                </div>
                <p className="cs-muted">{p.body}</p>
              </Card>
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== The lifecycle: a state machine, not a checklist ===== */}
      <Reveal>
        <Section
          eyebrow="The lifecycle"
          title="A state machine, not a checklist."
          lede="VERIFY failing reopens PLAN. There is no shortcut to SHIP. The machine owns the path — the engineer does not override it inline."
        >
          <Terminal
            label="kernel/lifecycle.ts"
            status={
              <StatusChip label="guarded transitions" tone="accent" dot />
            }
          >
            {`dispatch({
  agent:        `}
            <span className="cs-tok-accent">&quot;db-migrator&quot;</span>
            {`,
  model:        `}
            <span className="cs-tok-muted">&quot;sonnet&quot;</span>
            {`,     // escalate to opus only on uncertainty
  isolation:    `}
            <span className="cs-tok-success">&quot;worktree&quot;</span>
            {`,   // parallel writers never share a tree
  side_effects: `}
            <span className="cs-tok-danger">false</span>
            {`,       // the kernel holds secrets, not the agent
});

// VERIFY fails → state machine reopens PLAN
// No edge to SHIP exists until VERIFY passes`}
          </Terminal>
        </Section>
      </Reveal>

      {/* ===== Framing: governed, not magic ===== */}
      <Reveal>
        <Section
          eyebrow="The framing"
          title="A governed kernel, not autonomous magic."
          lede="The kernel does not make agents smarter. It makes them accountable: every dispatch declares its lane and its boundary, the kernel holds the credentials, and the lifecycle owns the path to ship."
          band="surface"
        >
          <FeatureGrid cols={3}>
            {(
              [
                {
                  icon: "shield" as const,
                  title: "Credential boundary",
                  body: "The kernel holds secrets. An agent that wants to deploy cannot — that capability lives on one audited side of the seam.",
                },
                {
                  icon: "git-branch" as const,
                  title: "Declared lanes",
                  body: "Model, tools, and isolation are declared at dispatch — not defaulted to the most powerful option. Escalate on uncertainty, not habit.",
                },
                {
                  icon: "file-check" as const,
                  title: "Schema at load",
                  body: "Every agent file is validated against a typed schema before it is allowed to run. An undeclared tool is a load-time error, not a runtime surprise.",
                },
              ] as const
            ).map((item) => (
              <Card key={item.title}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cs-space-3)",
                    marginBottom: "var(--cs-space-3)",
                  }}
                >
                  <Icon name={item.icon} size="md" />
                  <span className="cs-card-title">{item.title}</span>
                </div>
                <p className="cs-muted">{item.body}</p>
              </Card>
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Licensing ===== */}
      <Reveal>
        <Section
          eyebrow="How it ships"
          title="A composition of the same base."
          lede="Agentic-Dev is an edition, not a fork — built on the audited Caisson base every other edition shares. Buy it outright, take the kernel à la carte, or subscribe for credits and updates."
        >
          <FeatureGrid cols={3}>
            {(
              [
                {
                  title: "One-time",
                  body: "Buy the edition outright and own the source. No recurring seat fee.",
                },
                {
                  title: "Per-module",
                  body: "Take the kernel à la carte onto your Caisson base. Pay for what you use.",
                },
                {
                  title: "Developer plan",
                  body: "Subscription — credits, framework updates, private-registry pulls.",
                },
              ] as const
            ).map(({ title, body }) => (
              <Card key={title}>
                <p className="cs-card-title">{title}</p>
                <p
                  className="cs-muted"
                  style={{ marginTop: "var(--cs-space-2)" }}
                >
                  {body}
                </p>
              </Card>
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== FAQ ===== */}
      <Reveal>
        <Section eyebrow="Questions" title="Common questions." band="tint">
          <Faq items={FAQS} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Section eyebrow="Get started" id="get-started">
        <h2 className="cs-section-title">Ship governed agents.</h2>
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          Buy the edition outright and own the source, or take the kernel à la
          carte onto your existing Caisson base. Scaffold a project and put a
          governed agent to work.
        </p>
        <div
          style={{
            display: "flex",
            gap: "var(--cs-space-3)",
            flexWrap: "wrap",
          }}
        >
          {editionCartItem && (
            <AddToCartButton item={editionCartItem} variant="primary" />
          )}
          <Button href="/docs/agentic-dev" variant="ghost">
            Read the docs
          </Button>
        </div>
      </Section>
    </>
  );
}
