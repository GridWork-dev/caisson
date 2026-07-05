import Link from "next/link";

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
import { editionCatalogItem, toCartItem } from "@/lib/catalog";
import { breadcrumb, serializeJsonLd, softwareApplication } from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import { EDITION_MARKS, moduleMark } from "@/lib/marks";
import {
  editionPrice,
  formatPrice,
  formatUsd,
  MODULE_PRICES,
  priceById,
} from "@/lib/pricing";
import { TrackView } from "@/components/track-view";

const AGENTIC_DEV_DESCRIPTION =
  "A governed-agent kernel for TypeScript codebases: typed agent/skill/rule schema, a guarded 7-act lifecycle, a sandboxed agent runner with a from-scratch scrubbed env, local hybrid memory, and a default-deny tool-exec gate. Own the source.";

export const metadata = buildMetadata({
  title: "Agentic-Dev",
  description: AGENTIC_DEV_DESCRIPTION,
  path: "/agentic-dev",
});

// Cart-ready CatalogItem for the peak-intent buy CTAs below (ADR-0192 single add-to-cart buy-verb).
const _catalogItem = editionCatalogItem("agentic-dev");
const editionCartItem = _catalogItem ? toCartItem(_catalogItem) : undefined;

// Prices for the licensing cards below — always derived from the pricing lib, never hardcoded.
const agentKernelModule = MODULE_PRICES.find((m) => m.id === "agent-kernel");
const agentRunnerModule = MODULE_PRICES.find((m) => m.id === "agent-runner");
const developerPrice = priceById("developer");
const bundlePrice = priceById("bundle");

/* ---------- Inside the agent-kernel package ---------- */
const PIECES = [
  {
    icon: "boxes" as const,
    label: "Typed agent / skill / rule schema",
    body: "Every agent, skill, and rule is a declared file — model lane, allowed tools, capability, side-effect flag. Validated against a schema at load, with a reference-integrity check: a ghost cross-ref throws before anything runs.",
  },
  {
    icon: "git-branch" as const,
    label: "Lifecycle state machine",
    body: "Work moves SPEC → PLAN → EXECUTE → VERIFY → SWEEP → EVAL → SHIP. Transitions are guarded: VERIFY fails, the machine reopens PLAN — SHIP is the only terminal state. The path is the policy.",
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

// Base substrate / no-standalone-SKU packages predate the F6 sellable-module mark set —
// tool-exec never got a standalone SKU or a bespoke mark, so it resolves through this local map
// (matches the compliance/ai-kit/local-first pages' same-shaped exception). Sellable members
// resolve via `moduleMark`.
const BASE_MEMBER_ICON: Record<string, IconName> = {
  "tool-exec": "terminal",
};

// The edition's real composed packages (record: edition-agent-dev.json memberModules) — icon +
// name + one-liner, priced via a StatusChip when the package is also sold standalone
// (`MODULE_PRICES`), linking to its module depth page; tool-exec has no standalone SKU at all.
const MEMBER_MODULES: readonly {
  id: string;
  name: string;
  oneLiner: string;
}[] = [
  {
    id: "agent-kernel",
    name: "Agent kernel",
    oneLiner:
      "Typed agent/skill/rule schema plus the guarded 7-act lifecycle FSM and hooks dispatcher — one of the edition's composed pieces, alongside local memory and the tool-exec gate.",
  },
  {
    id: "agent-runner",
    name: "Agent runner",
    oneLiner:
      "Spawns a headless coding agent as a detached subprocess in an isolated worktree with a from-scratch scrubbed env, streaming an auditable transcript.",
  },
  {
    id: "local-store",
    name: "Local hybrid memory",
    oneLiner:
      "Per-tenant vec0 + FTS5 recall with reciprocal-rank fusion and an FTS-only offline floor; no memory item is ever a secret.",
  },
  {
    id: "tool-exec",
    name: "Sandboxed tool-exec gate",
    oneLiner:
      "Default-deny allowlist over Zod-strict argv schemas and execFile arg-arrays — an agent never reaches a shell.",
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

/* ---------- FAQ (AI retrieval; also visible on page) — record: edition-agent-dev.json ---------- */
const FAQS = [
  {
    question: "What's actually running when an agent executes?",
    answer:
      "@caisson/agent-runner spawns the agent CLI as a detached subprocess in an isolated worktree with a child environment built from scratch — never a spread of your process env — plus a fixed non-secret passthrough allowlist and only the target provider's key. Every run streams a durable .jsonl transcript and resolves to a structured report of tool calls, files touched, and the final result.",
  },
  {
    question: "Can I buy just the kernel or just the runner?",
    answer:
      "Yes. The agent kernel and the agent runner are both purchasable à la carte onto your existing Caisson base. The full Agentic-Dev edition also composes local hybrid memory (sold standalone under the Local-first edition, not Agentic-Dev) and the tool-exec gate (no standalone SKU at all).",
  },
  {
    question: "Does the runner or the kernel ever hold a credential?",
    answer:
      "No. Construction of the three pieces the edition factory composes — kernel, memory, tool-exec gate — holds no credential and makes no network or LLM call. The agent runner ships as its own package alongside the edition; its buildEngineEnv() step is the one place a secret could reach a spawned process, and a ship-blocking leak-guard test attacks it with a polluted parent env and asserts the exact child env key set.",
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
    {`
  # a lane, not a default
  # to the top tier
tools:        [read, edit,
  run-tests]
side_effects: `}
    <span className="cs-tok-danger">false</span>
    {`
  # cannot push, deploy,
  # or read a secret
gate:         `}
    <span className="cs-tok-success">human-approval</span>
    {`
  # data-migration tag →
  # operator re-entry`}
  </Terminal>
);

/* ---------- Agent-runner spawn artifact ---------- */
const RunnerSpawn = (
  <Terminal
    label="agent-runner — spawn"
    status={<StatusChip label="isolated worktree" tone="accent" dot />}
  >
    {`$ caisson-agent run --profile claude-code --task "fix flaky test"\n`}
    <span className="cs-tok-muted">
      {
        "  buildEngineEnv(): fixed allowlist + provider key only — never a process.env spread\n"
      }
    </span>
    <span className="cs-tok-success">{"✓"}</span>
    {" worktree: .agent-runs/8f2c1a  ·  transcript: run-8f2c1a.jsonl\n"}
    <span className="cs-tok-muted">
      {"  tool_calls: 14  files_touched: 3  result: "}
    </span>
    <span className="cs-tok-success">{"pass"}</span>
  </Terminal>
);

export default function AgenticDevPage() {
  const appLd = softwareApplication({
    name: "Caisson Agentic-Dev",
    description: AGENTIC_DEV_DESCRIPTION,
    url: `${SITE_URL}/agentic-dev`,
    priceId: "agentic-dev",
  });

  const bcLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Agentic-Dev", path: "/agentic-dev" },
  ]);

  return (
    <>
      <TrackView item="edition:agentic-dev" />
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
        title="A governed agent lifecycle, plus a sandboxed runner to execute it."
        lede={
          <>
            Agents declare their model lane, their tools, and their blast radius
            up front. A lifecycle state machine refuses to advance a run that
            failed verify. And when it&apos;s time to actually spawn an agent,
            the runner builds its child environment from scratch — never a
            spread of your process env — so a credential you never intended to
            hand over cannot leak into the sandbox.
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
            label={`Own the source · ${editionPrice("agentic-dev")}`}
            dot
          />
        }
        artifact={AgentDeclaration}
      />

      {/* ===== What it composes ===== */}
      <Section
        eyebrow="What it composes"
        title="A governed kernel, not a wrapper."
        lede="@caisson/agent-kernel is one of the pieces the Agentic-Dev edition composes together as peers, alongside local memory and the tool-exec gate, all built on the same open @caisson/kernel base every edition shares. It carries a typed agent/skill/rule schema with a reference-integrity validator (a ghost cross-ref throws before anything runs), the 7-act lifecycle FSM (SPEC → PLAN → EXECUTE → VERIFY → SWEEP → EVAL → SHIP, with a failed VERIFY reopening PLAN and SHIP as the only terminal state), governance guards, and the hooks dispatcher that fires lifecycle events without handing a hook a credential the kernel didn't give it."
        band="tint"
      />

      {/* ===== Media slot (ADR-0237 F2) ===== */}
      <Section>
        <MediaPlaceholder icon={EDITION_MARKS["agentic-dev"]} />
      </Section>

      {/* ===== Four composed packages ===== */}
      <Reveal>
        <Section
          eyebrow="What ships in the box"
          title="Four composed packages, not one kernel."
          lede="Each member is a real workspace dependency. The kernel, the runner, and local memory each carry a standalone price; the tool-exec gate has no standalone SKU."
        >
          <FeatureGrid cols={2}>
            {MEMBER_MODULES.map((m) => (
              <MemberModuleCard key={m.id} {...m} />
            ))}
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== Inside the agent-kernel package ===== */}
      <Reveal>
        <Section
          eyebrow="Inside the agent-kernel package"
          title="Four parts, each a declared seam."
          lede="No part is a black box. Each is a file you can read, diff, and gate in review before an agent ever runs."
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
          band="surface"
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

      {/* ===== Spawns agents, not just scaffolds them ===== */}
      <Reveal>
        <Section
          eyebrow="The agent runner"
          title="Spawns agents, not just scaffolds them."
          lede="@caisson/agent-runner spawns a headless coding-agent CLI as a detached subprocess in an isolated worktree, streams an auditable .jsonl transcript that survives the launcher exiting, and parses it into a structured run report (tool calls, files touched, final result). The child environment is built from scratch — never spread from process.env — with a fixed non-secret passthrough allowlist and only the target provider's key, so a secret sitting in your shell has no path into the sandbox. Provider-agnostic: name the binary, the env-var names for the endpoint and key, the model, and an argv template; a worked Claude Code CLI profile ships as the reference. It ships as its own package alongside the edition, not wired into the kernel's lifecycle."
        >
          {RunnerSpawn}
        </Section>
      </Reveal>

      {/* ===== Local memory and a sandboxed exec gate ===== */}
      <Reveal>
        <Section
          eyebrow="Memory and the exec gate"
          title="Local memory, and a sandboxed exec gate."
          lede="@caisson/local-store gives the edition hybrid vector + full-text recall (vec0 + FTS5 with reciprocal-rank fusion, an FTS-only offline floor when no embedder is wired) scoped per tenant at the file level. @caisson/tool-exec is the governed tool-execution gate composed alongside it: default-deny allowlist, Zod-strict argv schemas, execFile arg-arrays — never a shell — so an agent that wants to run a command only gets the ones you explicitly allowed. Neither piece makes an LLM call or imports a vendor SDK; the composed edition holds no credential of its own."
          band="surface"
        />
      </Reveal>

      {/* ===== Framing: governed, not magic ===== */}
      <Reveal>
        <Section
          eyebrow="The framing"
          title="A governed kernel, not autonomous magic."
          lede="The kernel does not make agents smarter. It makes them accountable: every dispatch declares its lane and its boundary, the kernel holds the credentials, and the lifecycle owns the path to ship."
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
          lede="Agentic-Dev is a composition of the same open Caisson base every edition shares, not a fork. Buy it outright, take a piece à la carte, or subscribe for credits and updates."
          band="tint"
        >
          <FeatureGrid cols={3}>
            <Card>
              <p className="cs-card-title">One-time</p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Buy the edition outright for {editionPrice("agentic-dev")} and
                own the source — all four composed pieces, kernel through the
                agent runner.
              </p>
            </Card>
            <Card>
              <p className="cs-card-title">Per-module</p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Take just the kernel
                {agentKernelModule
                  ? ` (${formatUsd(agentKernelModule.amount)})`
                  : ""}{" "}
                or just the runner
                {agentRunnerModule
                  ? ` (${formatUsd(agentRunnerModule.amount)})`
                  : ""}{" "}
                à la carte onto your Caisson base.
              </p>
            </Card>
            <Card>
              <p className="cs-card-title">Developer plan</p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                {developerPrice ? formatPrice(developerPrice) : "Subscription"}{" "}
                adds credits, framework updates, and private-registry pulls
                across whatever you&apos;ve bought. The Everything bundle
                {bundlePrice ? ` (${formatPrice(bundlePrice)})` : ""} covers all
                four editions and the base in one purchase.
              </p>
            </Card>
          </FeatureGrid>
        </Section>
      </Reveal>

      {/* ===== FAQ ===== */}
      <Reveal>
        <Section eyebrow="Questions" title="Common questions." band="surface">
          <Faq items={FAQS} style={{ marginTop: "var(--cs-space-8)" }} />
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Section eyebrow="Get started" id="get-started">
        <h2 className="cs-section-title">Ship governed agents.</h2>
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          Buy the edition outright and own the source, or take the kernel or the
          runner à la carte onto your existing Caisson base. Scaffold a project
          and put a governed agent to work.
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
