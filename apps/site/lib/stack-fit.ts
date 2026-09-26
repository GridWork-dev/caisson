// The "does it fit my stack?" data — the honest adapter surface for /stack-fit (research-response
// wave, ADR-0272 §2). Integration fit is the objection the research names as the deadliest (deals
// die there), and the neutralizers already ship. Every row here is true-to-code, verified against
// the package source (copy law ADR-0080: no invented claims). Where a backend has a real limitation
// it is stated, not hidden.
//
// The DB-posture map is drift-pinned: stack-fit.test.ts asserts every sellable MODULES id has
// a posture, so a new module can't ship without an honest DB classification.
import type { IconName } from "@caisson/ui/components";

/** Whether a module pulls in a database of its own. */
export type DbPosture = "postgres" | "sqlite" | "none";

/**
 * Per-module database posture, keyed by MODULES id. Verified against each package's deps +
 * imports:
 *   - `postgres`: builds on @caisson/tenancy-rls (fail-closed Postgres RLS) or the pg-boss job queue.
 *   - `sqlite`:   runs on bun:sqlite / sqlite-vec, on-device — no server database.
 *   - `none`:     ships no database dependency of its own (crypto, in-process logic, on-device ONNX,
 *                 or logic that runs over a handle you inject).
 * retention-runner is `postgres` transitively (it schedules through @caisson/jobs → pg-boss).
 */
export const MODULE_DB_POSTURE: Record<string, DbPosture> = {
  // Postgres — tenant-isolation / metering / ledger built on tenancy-rls (or the job queue), plus
  // the modules that ship their own RLS'd Postgres tables (field-crypto: the field_keys
  // key-version store; alerting: the alert_audit trail).
  "audit-worm": "postgres",
  "ai-meter": "postgres",
  "prompt-registry": "postgres",
  credits: "postgres",
  "org-controls": "postgres",
  "billing-orchestration": "postgres",
  "retention-runner": "postgres",
  "field-crypto": "postgres",
  alerting: "postgres",
  // agent-trajectory ships PG-backed trajectory/run-state stores on tenancy-rls (memory impls
  // exist for tests, but the durable posture is Postgres).
  "agent-trajectory": "postgres",
  // access-review ships its own RLS'd Postgres table (access_review_campaign, ENABLE + FORCE
  // ROW LEVEL SECURITY) and schedules its open/close tasks through @caisson/jobs → pg-boss.
  "access-review": "postgres",
  // SQLite / on-device — no server database.
  "local-store": "sqlite",
  "local-sync": "sqlite",
  // No database of its own — crypto, in-process logic, on-device inference, or injected-handle logic.
  "ai-evals": "none",
  guardrails: "none",
  "agent-kernel": "none",
  "agent-runner": "none",
  "compliance-core": "none",
  "frameworks-pack": "none",
  "oscal-spine": "none",
  "signing-primitive": "none",
  "local-inference": "none",
  "local-privacy": "none",
  "tool-exec": "none",
  "ui-pro": "none",
  // risk-register is pure in-process scoring (computeResidual) plus a byte-stable artifact
  // builder; overrides append onto a CALLER-injected audit chain it does not own or migrate.
  "risk-register": "none",
  // trust-page is a pure render function (no I/O, no clock) over a caller-supplied evidence-pack
  // manifest — it ships no table and no migration of its own.
  "trust-page": "none",
};

export interface PostureGroup {
  posture: DbPosture;
  icon: IconName;
  heading: string;
  note: string;
}

/** The three posture buckets, in display order, with an honest one-line note each. */
export const POSTURE_GROUPS: readonly PostureGroup[] = [
  {
    posture: "postgres",
    icon: "database",
    heading: "Requires Postgres",
    note: "Built on the fail-closed RLS base or the pg-boss job queue, or shipping their own RLS'd Postgres tables (field-crypto's key-version store, alerting's audit trail). Postgres by design, that is where the isolation guarantee lives.",
  },
  {
    posture: "sqlite",
    icon: "cpu",
    heading: "Runs on SQLite, on-device",
    note: "A single SQLite file per tenant (bun:sqlite + sqlite-vec), on the device, no server database, no vector-cloud vendor in the loop.",
  },
  {
    posture: "none",
    icon: "check",
    heading: "No database of its own",
    note: "Crypto, in-process logic, or on-device inference, these add a capability without pulling in a database. They run over a handle you inject or over no store at all.",
  },
];

/** The DB-posture group for a module id, or undefined for an unmapped id, the single-source the
 *  marketplace cards + viewer read so a module's honest database classification (from /stack-fit)
 *  shows at the point of purchase, not only on the standalone page (ADR-0285 §2). */
export function modulePostureGroup(id: string): PostureGroup | undefined {
  const posture = MODULE_DB_POSTURE[id];
  return posture
    ? POSTURE_GROUPS.find((g) => g.posture === posture)
    : undefined;
}

export interface StackAxis {
  icon: IconName;
  /** The axis the buyer is checking. */
  title: string;
  /** The one-line honest answer. */
  fit: string;
  /** The concrete, shipped options. */
  supported: readonly string[];
  /** The honest caveat / how it actually works, always shown. */
  note: string;
}

/** The adapter axes, each true-to-code. */
export const STACK_AXES: readonly StackAxis[] = [
  {
    icon: "database",
    title: "ORM",
    fit: "Bring your existing Drizzle or Prisma call sites.",
    supported: [
      "Drizzle bridge: queryDrizzle / execDrizzle",
      "Prisma bridge: createPrismaBridge",
      "Raw SQL through the tenant executor",
    ],
    note: "The bridges route your query builder's generated SQL through the fail-closed tenant executor, a rename at the call site, not a schema rewrite or a switch of ORM. Neither adds a runtime dependency on drizzle-orm or @prisma/client; they bridge the query surface, and RLS still enforces isolation underneath.",
  },
  {
    icon: "lock",
    title: "Auth",
    fit: "better-auth out of the box, or your own provider behind one port.",
    supported: [
      "Magic-link + email / password",
      "GitHub · Google · Discord OAuth (env-gated)",
      "WorkOS SSO (via org-controls)",
    ],
    note: "The base depends only on a provider-agnostic SessionProvider port. better-auth is the reference implementation, swap in your own provider without touching the tenancy, billing, or credits packages, which know only the interface.",
  },
  {
    icon: "worm",
    title: "Object storage & WORM",
    fit: "S3 Object-Lock, Google Cloud Storage, or Cloudflare R2.",
    supported: [
      "AWS S3 Object-Lock: per-object, GOVERNANCE + COMPLIANCE",
      "Google Cloud Storage: per-object retention lock",
      "Cloudflare R2: bucket-level lock rules",
      "Local filesystem: for development",
    ],
    note: "One ArtifactStore port, four backends, write-once enforced on each. R2 holds retention at the bucket-lock-rule level rather than per object, the adapter fails closed at construction if the key prefix is not covered by an enabled rule, and refuses a per-object shorten rather than faking it.",
  },
  {
    icon: "gauge",
    title: "AI providers",
    fit: "OpenRouter, Bedrock, Azure OpenAI, Ollama, and more, behind one gateway.",
    supported: [
      "OpenRouter · AWS Bedrock · Azure OpenAI · Ollama",
      "OpenAI · Anthropic · Google · Groq · Mistral · Together",
      "On-device ONNX (local-inference)",
    ],
    note: "infer() and embed() resolve a lane to a provider from config, so you swap the model behind the gateway without touching a call site. No provider is hardcoded, and a per-tenant BYOK key resolves ahead of the shared lane.",
  },
  {
    icon: "server",
    title: "MCP transports",
    fit: "stdio and Streamable HTTP.",
    supported: [
      "stdio: createStdioMcpServer",
      "Streamable HTTP: stateless, Bearer + host allowlist",
    ],
    note: "The HTTP transport is stateless per request with mandatory Bearer auth and a DNS-rebinding host allowlist required at construction. Both transports share one transport-agnostic core; there is no SSE transport.",
  },
];
