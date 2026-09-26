/**
 * The demo surface's route ids (ADR-0400) — one embed route per poke, served at
 * `/demos/embed/<id>`. Each id is the module's package name minus the `@caisson-sh/` scope, which is
 * also the key apps/site's media manifest uses for its `kind: "poke"` slides. That shared spelling
 * is the whole contract between the two apps: the site emits an iframe pointing at
 * `/demos/embed/<its manifest key>`, and this list is what answers.
 *
 * Plain data in its own module, deliberately: `registry.tsx` is a client component (every poke is
 * `ssr: false`), and the embed route's `generateStaticParams` runs on the server. Splitting the
 * list out is what lets both read it without the server pulling a client module.
 *
 * Kept in lockstep with the site by `apps/site/lib/poke-embed-parity.test.ts` — that test reads
 * apps/site's manifest and fails on either direction of drift (a poke the site renders with no
 * route here, or a route here the site never asks for). It lives on the site side because that is
 * where the manifest is; this list is the half it checks against.
 */
export const POKE_IDS = [
  "access-review",
  "agent-kernel",
  "agent-runner",
  "agent-trajectory",
  "ai-evals",
  "ai-meter",
  "alerting",
  "audit-worm",
  "billing-orchestration",
  "compliance-core",
  "credits",
  "field-crypto",
  "frameworks-pack",
  "guardrails",
  "local-inference",
  "local-privacy",
  "local-store",
  "local-sync",
  "org-controls",
  "oscal-spine",
  "prompt-registry",
  "retention-runner",
  "risk-register",
  "signing-primitive",
  "tool-exec",
  "trust-page",
] as const;

export type PokeId = (typeof POKE_IDS)[number];

const POKE_ID_SET: ReadonlySet<string> = new Set(POKE_IDS);

export function isPokeId(value: string): value is PokeId {
  return POKE_ID_SET.has(value);
}
