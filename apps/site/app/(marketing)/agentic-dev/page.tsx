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
import { TrialPath } from "@/components/trial-path";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { MediaCarousel } from "@/components/media-carousel";
import { mediaSlides } from "@/lib/media-manifest";
import { requireBundlePage, spellCount } from "@/lib/bundle-pages";
import { bundleCatalogItem, toCartItem } from "@/lib/catalog";
import {
  breadcrumb,
  faqPage,
  serializeJsonLd,
  softwareApplication,
} from "@/lib/jsonld";
import { buildMetadata, SITE_URL } from "@/lib/metadata";
import { moduleMark } from "@/lib/marks";
import { hasModulePage } from "@/lib/module-pages";
import {
  bundlePrice,
  bundlePriceById,
  formatPrice,
  formatUsd,
  MODULE_PRICES,
  priceById,
} from "@/lib/pricing";
import { TrackView } from "@/components/track-view";

// Hero copy, member list, and FAQ read from the shared bundle content record (lib/bundle-pages.ts);
// the bespoke sections below stay page-local.
const record = requireBundlePage("agentic-dev");

export const metadata = buildMetadata({
  title: record.metaTitle,
  description: record.metaDescription,
  path: "/agentic-dev",
});

// Cart-ready CatalogItem for the peak-intent buy CTAs below (ADR-0192 single add-to-cart buy-verb).
const _catalogItem = bundleCatalogItem("agentic-dev");
const bundleCartItem = _catalogItem ? toCartItem(_catalogItem) : undefined;

// Prices for the licensing cards below — always derived from the pricing lib, never hardcoded.
const agentKernelModule = MODULE_PRICES.find((m) => m.id === "agent-kernel");
const agentRunnerModule = MODULE_PRICES.find((m) => m.id === "agent-runner");
const developerPrice = priceById("developer");
const everythingAnchor = bundlePriceById("everything");

/* ---------- Inside the agent-kernel package ---------- */
const PIECES = [
  {
    icon: "boxes" as const,
    label: "Typed agent / skill / rule schema",
    body: "Every agent, skill, and rule is a declared file, model lane, allowed tools, capability, side-effect flag. Validated against a schema at load, with a reference-integrity check: a ghost cross-ref throws before anything runs.",
  },
  {
    icon: "git-branch" as const,
    label: "Lifecycle state machine",
    body: "Work moves SPEC → PLAN → EXECUTE → VERIFY → SWEEP → EVAL → SHIP. Transitions are guarded: VERIFY fails, the machine reopens PLAN, SHIP is the only terminal state. The path is the policy.",
  },
  {
    icon: "shield" as const,
    label: "Governance guards",
    body: "Every transition guard and hook returns one of three decisions: allow, deny(reason), or mutate(context). A guard never runs an engine, it decides whether policy permits an already-legal move, fail-closed by default.",
  },
  {
    icon: "terminal" as const,
    label: "Hooks dispatcher",
    body: "Lifecycle events fire typed hooks, session-start recall, per-act logging, pre-commit gates. The dispatcher is the one audited seam; a hook cannot reach a credential the kernel did not hand it.",
  },
] as const;

// Base substrate / no-bespoke-mark packages predate the F6 sellable-module mark set — tool-exec
// never got a bespoke mark, so it resolves through this local map (matches the compliance/ai-kit/
// local-first pages' same-shaped exception). Sellable members resolve via `moduleMark`.
const BASE_MEMBER_ICON: Record<string, IconName> = {
  "tool-exec": "terminal",
};

// The bundle's real composed packages — read from the shared bundle content record. Priced via a
// StatusChip when a member is also sold standalone (`MODULE_PRICES`); linked to its module depth
// page only when one exists — tool-exec is priced but has no depth page yet, so it renders its
// price chip but stays non-interactive and unlinked (G5).
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
  const price = MODULE_PRICES.find((m) => m.id === id);
  // Linkable is gated on the depth page actually existing, not on price truthiness — a member can
  // be priced (MODULE_PRICES) with no depth page yet, and a Link to it 404s (G5).
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
      {price && (
        <div style={{ marginTop: "var(--cs-space-4)" }}>
          <StatusChip label={formatUsd(price.amount)} tone="muted" />
        </div>
      )}
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

/* ---------- MCP feature-card sequence (SYNTHESIS §6 Tier-1 row 9) ---------- */
// @caisson/mcp-server ships in the open Base substrate (every plan, not an Agentic-Dev-only SKU) —
// this is the page where an agent-tooling buyer is already looking for "where does my agent
// connect", so the sequence lives here rather than inventing a standalone module page for a
// package that has no separate SKU. Four real request-lifecycle stages, in order, each grounded in
// packages/mcp-server/src/server.ts.
const MCP_SEQUENCE = [
  {
    icon: "key" as const,
    step: "1. Authenticate",
    body: "A timing-safe Bearer compare against every issued buyer token, no early return, a match never leaks through response latency.",
  },
  {
    icon: "boxes" as const,
    step: "2. Discover",
    body: "listTools returns only what the caller owns. A tool from a bundle you don't own is invisible, not just refused, the same 404 as a tool that doesn't exist.",
  },
  {
    icon: "terminal" as const,
    step: "3. Generate",
    body: "The one write tool revalidates every requested module id and version against the SAME allowlisted registry index the CLI generator checks, then entitlement-expands your purchases before it ever calls the host.",
  },
  {
    icon: "shield" as const,
    step: "4. Govern",
    body: "A per-account rate limit gates every dispatch (fail-open only on a store fault, never on a real deny), and a retired tool answers 410 with a reason, never a bare 404 that leaves an integration guessing.",
  },
] as const;

/* ---------- FAQ (AI retrieval; also visible on page) — read from the record ---------- */
const FAQS = record.faq;

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
    label="agent-runner, spawn"
    status={<StatusChip label="isolated worktree" tone="accent" dot />}
  >
    {`$ caisson-agent run --profile claude-code --task "fix flaky test"\n`}
    <span className="cs-tok-muted">
      {
        "  buildEngineEnv(): fixed allowlist + provider key only, never a process.env spread\n"
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
    description: record.metaDescription,
    url: `${SITE_URL}/agentic-dev`,
    priceId: "agentic-dev",
  });

  const bcLd = breadcrumb([
    { name: "Home", path: "/" },
    { name: "Agentic-Dev", path: "/agentic-dev" },
  ]);

  // FAQPage mirrors the FAQS rendered visibly below (the <Faq> section) — only emitted because the
  // questions render on the page (jsonld.ts faqPage contract). The other five bundle pages already
  // carry this; this closes the one bundle-schema gap the AEO audit found (CAISSON-29).
  const faqLd = faqPage(FAQS);

  return (
    <>
      <TrackView item="bundle:agentic-dev" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(appLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(bcLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqLd) }}
      />

      {/* ===== Hero ===== */}
      <Hero
        eyebrow={record.hero.eyebrow}
        title={record.hero.title}
        lede={record.hero.lede}
        ctas={
          <>
            {bundleCartItem && (
              <AddToCartButton item={bundleCartItem} variant="primary" />
            )}
            <Button href="/docs/agentic-dev" variant="ghost">
              Read the docs
            </Button>
          </>
        }
        credentials={
          <StatusChip
            tone="accent"
            label={`Own the source · ${bundlePrice("agentic-dev")}`}
            dot
          />
        }
        artifact={AgentDeclaration}
      />

      {/* ===== What it composes ===== */}
      <Section
        eyebrow="What it composes"
        title="A governed kernel, not a wrapper."
        lede="@caisson/agent-kernel is one of the pieces the Agentic-Dev bundle composes together as peers, alongside local memory and the tool-exec gate, all built on the same open @caisson/kernel base every bundle shares. It carries a typed agent/skill/rule schema with a reference-integrity validator (a ghost cross-ref throws before anything runs), the 7-act lifecycle FSM (SPEC → PLAN → EXECUTE → VERIFY → SWEEP → EVAL → SHIP, with a failed VERIFY reopening PLAN and SHIP as the only terminal state), governance guards, and the hooks dispatcher that fires lifecycle events without handing a hook a credential the kernel didn't give it."
        band="tint"
      />

      {/* ===== Media slot (ADR-0237 F2) ===== */}
      <Section>
        <MediaCarousel
          slides={mediaSlides("bundle", "agentic-dev")}
          label="Agentic-Dev bundle media"
        />
      </Section>

      {/* ===== Four composed packages ===== */}
      <Reveal>
        <Section
          eyebrow="What ships in the box"
          title={`${spellCount(MEMBER_MODULES.length)} composed packages, not one kernel.`}
          lede="Each member is a real workspace dependency, and each one carries its own standalone price: the kernel, the runner, the trajectory log, local memory, and the tool-exec gate."
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
          lede="VERIFY failing reopens PLAN. There is no shortcut to SHIP. The machine owns the path, the engineer does not override it inline."
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
          lede="@caisson/agent-runner spawns a headless coding-agent CLI as a detached subprocess in an isolated worktree, streams an auditable .jsonl transcript that survives the launcher exiting, and parses it into a structured run report (tool calls, files touched, final result). The child environment is built from scratch (never spread from process.env) with a fixed non-secret passthrough allowlist and only the target provider's key, so a secret sitting in your shell has no path into the sandbox. Provider-agnostic: name the binary, the env-var names for the endpoint and key, the model, and an argv template; a worked Claude Code CLI profile ships as the reference. It ships as its own package alongside the bundle, not wired into the kernel's lifecycle."
        >
          {RunnerSpawn}
        </Section>
      </Reveal>

      {/* ===== Local memory and a sandboxed exec gate ===== */}
      <Reveal>
        <Section
          eyebrow="Memory and the exec gate"
          title="Local memory, and a sandboxed exec gate."
          lede="@caisson/local-store gives the bundle hybrid vector + full-text recall (vec0 + FTS5 with reciprocal-rank fusion, an FTS-only offline floor when no embedder is wired) scoped per tenant at the file level. @caisson/tool-exec is the governed tool-execution gate composed alongside it: default-deny allowlist, Zod-strict argv schemas, execFile arg-arrays (never a shell) so an agent that wants to run a command only gets the ones you explicitly allowed. Neither piece makes an LLM call or imports a vendor SDK; the composed bundle holds no credential of its own."
          band="surface"
        />
      </Reveal>

      {/* ===== Connect over MCP (SYNTHESIS §6 Tier-1 row 9) ===== */}
      <Reveal>
        <Section
          eyebrow="Connect over MCP"
          title="Where your agent connects."
          lede="Most kits ship an MCP server now; the difference is what it lets an agent do. @caisson/mcp-server ships in the open Base substrate (every plan gets it, not just Agentic-Dev) and it treats the agent as a principal: four stages on every call, in order, the same server the buyer dashboard and any MCP-speaking agent client connect through."
        >
          <FeatureGrid cols={2}>
            {MCP_SEQUENCE.map((s) => (
              <Card key={s.step}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--cs-space-3)",
                    marginBottom: "var(--cs-space-3)",
                  }}
                >
                  <Icon name={s.icon} size="md" aria-label={s.step} />
                  <span className="cs-card-title">{s.step}</span>
                </div>
                <p className="cs-muted">{s.body}</p>
              </Card>
            ))}
          </FeatureGrid>
        </Section>
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
                  body: "The kernel holds secrets. An agent that wants to deploy cannot, that capability lives on one audited side of the seam.",
                },
                {
                  icon: "git-branch" as const,
                  title: "Declared lanes",
                  body: "Model, tools, and isolation are declared at dispatch, not defaulted to the most powerful option. Escalate on uncertainty, not habit.",
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
          lede="Agentic-Dev is a composition of the same open Caisson base every bundle shares, not a fork. Buy it outright, take a piece à la carte, or subscribe for credits and updates."
          band="tint"
        >
          <FeatureGrid cols={3}>
            <Card>
              <p className="cs-card-title">One-time</p>
              <p
                className="cs-muted"
                style={{ marginTop: "var(--cs-space-2)" }}
              >
                Buy the bundle outright for {bundlePrice("agentic-dev")} and own
                the source, all four composed pieces, kernel through the agent
                runner.
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
                {everythingAnchor
                  ? ` (${formatPrice(everythingAnchor)})`
                  : ""}{" "}
                covers the whole catalog and the base in one purchase.
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

      {/* ===== Prove fit in week one (ADR-0272 §3) ===== */}
      <Reveal>
        <Section
          eyebrow="Trial path"
          title="Prove fit in week one."
          lede="Don't take the fit on faith, scaffold the audited base and run it on your own stack before you commit."
        >
          <div style={{ marginTop: "var(--cs-space-6)" }}>
            <TrialPath />
          </div>
        </Section>
      </Reveal>

      {/* ===== Get started ===== */}
      <Section eyebrow="Get started" id="get-started">
        <h2 className="cs-section-title">Ship governed agents.</h2>
        <p className="cs-lede" style={{ marginBottom: "var(--cs-space-6)" }}>
          Buy the bundle outright and own the source, or take the kernel or the
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
          {bundleCartItem && (
            <AddToCartButton item={bundleCartItem} variant="primary" />
          )}
          <Button href="/docs/agentic-dev" variant="ghost">
            Read the docs
          </Button>
        </div>
      </Section>
    </>
  );
}
