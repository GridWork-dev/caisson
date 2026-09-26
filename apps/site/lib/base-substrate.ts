import type { IconName } from "@caisson-sh/ui/components";

// The base substrate — the SINGLE list every surface that names it reads from. Every package is
// Apache-2.0; this list is the foundation layer the rest compose onto, and the /docs/base page is
// the human summary this mirrors.
//
// Why this file exists: two prose lists (the plans and modules pages) had drifted `credits` INTO
// the base and dropped `rate-limit` OUT of it. One const kills that drift class, and
// `base-substrate.test.ts` fails if the prose or the capability tiles drift from it.

/** The 13 substrate packages — the runtime/base half of the open set. */
export const BASE_SUBSTRATE_PACKAGES = [
  "kernel",
  "auth",
  "tenancy-rls",
  "ui",
  "billing",
  "jobs",
  "email",
  "ai-config",
  "mcp-server",
  "registry-schema",
  "observability",
  "rate-limit",
  "ds-manifest",
] as const;

/** The generator tooling — called out separately in prose ("…and the generator tooling: …"). */
export const BASE_GENERATOR_TOOLING = ["cli", "migrate"] as const;

/** All 15 base packages, substrate then tooling. */
export const BASE_PACKAGES = [
  ...BASE_SUBSTRATE_PACKAGES,
  ...BASE_GENERATOR_TOOLING,
] as const;

/** Bare comma list of the substrate packages, for prose ("kernel, auth, tenancy-rls, …"). */
export function baseSubstrateList(): string {
  return BASE_SUBSTRATE_PACKAGES.join(", ");
}

/** Bare comma list of the generator tooling ("cli, migrate"). */
export function baseToolingList(): string {
  return BASE_GENERATOR_TOOLING.join(", ");
}

/** Scoped, middot-joined list of every base package ("@caisson-sh/kernel · @caisson-sh/auth · …"). */
export function basePackagesScoped(): string {
  return BASE_PACKAGES.map((p) => `@caisson-sh/${p}`).join(" · ");
}

/**
 * A grouped "batteries included" capability — the home of the open-base anxiety-relief beat (the
 * SYNTHESIS §6 Tier-1 tile grid). Every id in `packages` is a real Apache-2.0 base package; the
 * tiles PARTITION `BASE_PACKAGES` (each package named exactly once), asserted in the test.
 */
export interface BaseCapability {
  icon: IconName;
  title: string;
  body: string;
  /** The base packages this tile represents — honest, a subset of `BASE_PACKAGES`. */
  packages: readonly string[];
}

export const BASE_CAPABILITIES: readonly BaseCapability[] = [
  {
    icon: "database",
    title: "Multi-tenant Postgres, fail-closed",
    body: "Row-level security with FORCE on the audited kernel: a query that never set the tenant context returns nothing, never everything. The same isolation every commercial bundle composes onto.",
    packages: ["tenancy-rls", "kernel"],
  },
  {
    icon: "lock",
    title: "Auth and the open component base",
    body: "Session and credential handling, plus the @caisson-sh/ui component base the marketing site and buyer dashboard both render with — not a bolt-on you wire up later.",
    packages: ["auth", "ui"],
  },
  {
    icon: "wallet",
    title: "Billing, jobs, and email",
    body: "A billing-provider port, a background-job runner, and transactional email — the operational plumbing every SaaS needs standing before it ships its first feature.",
    packages: ["billing", "jobs", "email"],
  },
  {
    icon: "server",
    title: "AI config and a governed MCP server",
    body: "Provider-agnostic AI configuration and a Model Context Protocol server that treats agents as principals: timing-safe Bearer auth on every session, a per-account rate limit on every dispatch. Most kits ship an MCP server now — the question is what it lets an agent do. The design-system contracts an agent reasons over — the component manifest, its typed reader, the contrast and static-usage checkers — are open source too, in @caisson-sh/ds-manifest.",
    packages: ["ai-config", "mcp-server", "ds-manifest"],
  },
  {
    icon: "gauge",
    title: "The registry contract and observability",
    body: "The signed-registry schema, OpenTelemetry observability, and rate limiting — the same operational spine the commercial services run on, in the open.",
    packages: ["registry-schema", "observability", "rate-limit"],
  },
  {
    icon: "terminal",
    title: "The generator and migrations",
    body: "Scaffold the whole base in one command and run migrations. The create-caisson tooling ships open — you own the generator, not just the output.",
    packages: ["cli", "migrate"],
  },
];
