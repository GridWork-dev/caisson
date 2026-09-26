// The module catalog the site demonstrates: five module families plus the whole-catalog
// Everything composition, and every module with its family membership. Display data only: no
// prices, no purchase ids.

/** The module-family ids (ADR-0257 vocabulary). Kept SITE-LOCAL on purpose: this module is
 *  client-reachable, and pulling `@caisson-sh/registry-schema` drags in its `node:fs` disk loader. */
export const BUNDLE_IDS = [
  "compliance",
  "ai-production",
  "local-first",
  "agentic-dev",
  "provenance",
  "everything",
] as const;
export type BundleId = (typeof BUNDLE_IDS)[number];

export function isBundleId(id: string): id is BundleId {
  return (BUNDLE_IDS as readonly string[]).includes(id);
}

/** Every family a module can be a member of: all but the whole-catalog `everything`, which holds
 *  every module by construction and so is never listed on a per-module `bundles[]`. */
export const PERSONA_BUNDLE_IDS = BUNDLE_IDS.filter(
  (b): b is Exclude<BundleId, "everything"> => b !== "everything",
);

export interface Bundle {
  id: BundleId;
  label: string;
  /** One-line position note. */
  note: string;
}

/** The six module families, in display order. */
export const BUNDLES: readonly Bundle[] = [
  {
    id: "compliance",
    label: "Compliance",
    note: "The compliance wedge: fail-closed RLS, WORM, an audit chain, evidence packs, access reviews, the AI risk register, a buyer trust page, and the framework + signing carves.",
  },
  {
    id: "ai-production",
    label: "AI-Production",
    note: "The production-rigor layer for AI features: metering, guardrails, prompt versioning, and the CI eval harness.",
  },
  {
    id: "local-first",
    label: "Local-first",
    note: "On-device inference, a privacy egress gate, and local vector search: data stays on device unless you explicitly enable a hosted transport.",
  },
  {
    id: "agentic-dev",
    label: "Agentic-Dev",
    note: "The governed-agent kernel: typed agent/skill/rule schema, a guarded lifecycle, and sandboxed execution.",
  },
  {
    id: "provenance",
    label: "Provenance",
    note: "Cryptographic provenance: detached signing, an append-only WORM audit chain, and per-tenant field encryption.",
  },
  {
    id: "everything",
    label: "Everything",
    note: "The full catalog: every module family and every standalone module together.",
  },
] as const;

export interface CatalogModule {
  /** Slug: the registry id and the `/marketplace/modules/<id>` path segment. */
  id: string;
  label: string;
  /** The families this module belongs to (1:N). Never lists `everything`. Empty = standalone. */
  bundles: readonly BundleId[];
  /** One-line benefit. */
  blurb: string;
}

export const MODULES: readonly CatalogModule[] = [
  // ---- Compliance ----
  {
    id: "field-crypto",
    label: "Field encryption",
    bundles: ["compliance", "ai-production", "local-first", "provenance"],
    blurb:
      "Per-tenant field encryption (HKDF-SHA256): each tenant's ciphertext is sealed under its own derived key, and a cross-tenant read fails to decrypt in the test suite, every run.",
  },
  {
    id: "audit-worm",
    label: "Audit chain + WORM",
    bundles: ["compliance", "provenance"],
    blurb:
      "Append-only SHA-256 audit chain plus S3 Object-Lock WORM evidence storage. Tamper breaks the link.",
  },
  {
    id: "retention-runner",
    label: "Retention runner",
    bundles: ["compliance"],
    blurb:
      "Policy-driven data retention on a schedule: expiry and legal-hold, enforced automatically.",
  },
  {
    id: "alerting",
    label: "Alert pipeline",
    bundles: ["compliance"],
    blurb:
      "Deduped, rate-capped alert delivery with quiet hours and an audit trail: the SOC 2 CC7.2 alerting control your compliance program can point to.",
  },
  {
    id: "access-review",
    label: "Access reviews",
    bundles: ["compliance"],
    blurb:
      "Audit-prep access-review campaigns: import a membership snapshot, record per-reviewee attested approve/revoke decisions into the WORM log, and close with every undecided reviewee flagged, never auto-approved.",
  },
  {
    id: "risk-register",
    label: "AI risk register",
    bundles: ["compliance"],
    blurb:
      "Likelihood x impact risk scoring with a computed residual, operator overrides recorded as chained exceptions, crosswalks into your framework packs, and a treatment-plan evidence artifact.",
  },
  {
    id: "trust-page",
    label: "Trust page",
    bundles: ["compliance"],
    blurb:
      "A self-contained trust page built from your evidence pack through allowlist-based redaction: host it anywhere to show prospects your compliance posture.",
  },
  // ---- AI-Production ----
  {
    id: "ai-meter",
    label: "Token metering",
    bundles: ["ai-production"],
    blurb:
      "PG-atomic token metering with per-tenant spend caps and a circuit breaker that trips before a runaway prompt loop reaches your invoice.",
  },
  {
    id: "ai-evals",
    label: "Eval harness",
    bundles: ["ai-production"],
    blurb:
      "Regression-grade evals that run in CI, ahead of production. A model swap that regresses fails the build, catching it before a customer's session does.",
  },
  {
    id: "guardrails",
    label: "Guardrails",
    bundles: ["ai-production"],
    blurb:
      "A single guardrail boundary between your app and the model: every call passes through the same PII redaction, moderation, and secret-shape gate.",
  },
  {
    id: "prompt-registry",
    label: "Prompt registry",
    bundles: ["ai-production"],
    blurb:
      "Versioned prompts with rollout history: promote or roll back a prompt by moving an alias pointer, no redeploy required.",
  },
  // ---- Local-first ----
  {
    id: "local-store",
    label: "Local vector store",
    bundles: ["local-first", "agentic-dev"],
    blurb:
      "Hybrid FTS5 + sqlite-vec search that runs on disk, one file per tenant, with no vector-cloud vendor in the loop.",
  },
  // ---- Agentic-Dev ----
  {
    id: "agent-kernel",
    label: "Agent kernel",
    bundles: ["agentic-dev"],
    blurb:
      "Typed agent/skill/rule schema plus the guarded lifecycle state machine: a failed VERIFY reopens PLAN, and the only path to SHIP runs back through it.",
  },
  {
    id: "agent-runner",
    label: "Agent runner",
    bundles: ["agentic-dev"],
    blurb:
      "Sandboxed, governed agent execution: spawn a headless coding agent into an isolated worktree and stream back an auditable transcript, with the child's environment built from scratch rather than inherited.",
  },
  {
    id: "agent-trajectory",
    label: "Agent trajectory",
    bundles: ["agentic-dev"],
    blurb:
      "The governed run record: an append-only, replayable event log of every agent step, tool proposal, approval, and spend, with sensitive bodies referenced by digest, paused runs encrypted at rest, and a deterministic replay for scoring and audit.",
  },
  // ---- Compliance carves ----
  {
    id: "compliance-core",
    label: "Compliance core",
    bundles: ["compliance"],
    blurb:
      "The fail-closed compliance substrate: the RLS-force evidence collector, isolation tests, and the SOC 2 / HIPAA evidence-pack generator that maps live controls to named clauses.",
  },
  {
    id: "frameworks-pack",
    label: "Frameworks pack",
    bundles: ["compliance"],
    blurb:
      "The framework control library: SOC 2, HIPAA, and EU AI Act mappings, the clause-to-control catalog the evidence packs render against.",
  },
  {
    id: "oscal-spine",
    label: "OSCAL spine",
    bundles: ["compliance"],
    blurb:
      "OSCAL v1.2.2 expression for assessment plans, results, POA&Ms, merged catalogs, ISO 27001 statements of applicability, and the vendored NIST 800-53 crosswalk.",
  },
  {
    id: "signing-primitive",
    label: "Signing primitive",
    bundles: ["compliance", "provenance"],
    blurb:
      "Detached Ed25519 + RFC-3161 signing over evidence bundles and audit roots: a verifiable signature a third party can check without your keys.",
  },
  // ---- AI-Production ----
  {
    id: "credits",
    label: "Credits + metering",
    bundles: ["ai-production"],
    blurb:
      "PG-atomic credit ledger with one integer denomination: grant, debit, and spend-cap credits across codegen and AI features, fail-closed on an empty balance (402).",
  },
  // ---- Local-first carves ----
  {
    id: "local-sync",
    label: "Local sync engine",
    bundles: ["local-first"],
    blurb:
      "Two-way offline sync: changesets, tombstones, a logical clock, and a reconcile pass with a convergence test, so the device catches up without a server round-trip.",
  },
  {
    id: "local-inference",
    label: "On-device inference",
    bundles: ["local-first"],
    blurb:
      "The InferenceBackend seam over a MiniLM-class ONNX model via transformers.js, SHA-256 hash-verified before use: inference on-device by default, hosted only by opt-in.",
  },
  {
    id: "local-privacy",
    label: "Privacy egress gate",
    bundles: ["local-first"],
    blurb:
      "A default-deny egress boundary every payload crosses before it can leave the process: no host is reachable unless a typed allowlist names it, and leaving it empty makes egress zero.",
  },
  {
    id: "tool-exec",
    label: "Tool-exec gate",
    bundles: ["agentic-dev"],
    blurb:
      "The governed tool-execution gate: a default-deny allowlist over Zod-strict argv schemas and execFile arg-arrays, so an agent reaches only the commands you explicitly allowed, never a shell.",
  },
  // ---- Standalone modules (in Everything, no family) ----
  {
    id: "org-controls",
    label: "Org controls",
    bundles: [],
    blurb:
      "WorkOS SSO plus the owner-gated multi-user surface: invite and manage account members, and the admin-write RLS layer that lets an owner mutate scoped tenant data under a dual-logged policy.",
  },
  {
    id: "billing-orchestration",
    label: "Billing orchestration",
    bundles: [],
    blurb:
      "The multi-provider billing engine: Paddle, Stripe, LemonSqueezy, and Polar behind one BillingProvider port, with idempotent webhook fulfillment and a domain event stream.",
  },
  {
    id: "ui-pro",
    label: "UI Pro",
    bundles: [],
    blurb:
      "The extended component layer on the open @caisson-sh/ui base: data-dense matrices, credential strips, and the elevation + glow treatments the brand system ships.",
  },
] as const;

/** Every module that is a member of `bundle`, in catalog order. */
export function modulesByBundle(bundle: BundleId): readonly CatalogModule[] {
  return MODULES.filter((m) => m.bundles.includes(bundle));
}

/** A family's display record by id. */
export function bundleById(id: BundleId): Bundle | undefined {
  return BUNDLES.find((b) => b.id === id);
}

// ---- The families × capabilities matrix — SINGLE SOURCE (ADR-0195) ----

/** A comparison-matrix row — structurally the kit's `SkuMatrixRow`, kept UI-decoupled here. */
export interface SkuRow {
  label: string;
  /** One cell per column: `true` = included, `false` = not, or a display string. */
  cells: readonly (boolean | string)[];
}

/** Matrix columns — the five families, in display order (Everything holds every module by
 *  construction, so a column for it would be all-true noise). */
export const SKU_COLUMNS = [
  "Compliance",
  "AI-Production",
  "Local-first",
  "Agentic-Dev",
  "Provenance",
] as const;

/** The capability rows. A cell is an INCLUSION claim; base capabilities (Apache-2.0, ship with
 *  everything, incl. fail-closed RLS) live on the one base row. */
export const SKU_FEATURE_ROWS: readonly SkuRow[] = [
  {
    label: "Postgres base: fail-closed RLS, auth (Apache-2.0)",
    cells: [true, true, true, true, true],
  },
  {
    label: "RLS-force evidence collector + isolation tests",
    cells: [true, false, false, false, false],
  },
  { label: "WORM evidence store", cells: [true, false, false, false, true] },
  {
    label: "Append-only audit chain",
    cells: [true, false, false, false, true],
  },
  {
    label: "Per-tenant field encryption",
    cells: [true, true, true, false, true],
  },
  {
    label: "Evidence-pack generator + framework mappings",
    cells: [true, false, false, false, false],
  },
  {
    label: "Detached Ed25519 + RFC-3161 evidence signing",
    cells: [true, false, false, false, true],
  },
  {
    label: "Alert pipeline + retention runner",
    cells: [true, false, false, false, false],
  },
  {
    label: "Token metering · spend caps · credit ledger",
    cells: [false, true, false, false, false],
  },
  {
    label: "Versioned prompts + guardrails",
    cells: [false, true, false, false, false],
  },
  {
    label: "CI eval harness",
    cells: [false, true, false, false, false],
  },
  {
    label: "On-device vector search",
    cells: [false, false, true, true, false],
  },
  {
    label: "On-device inference + offline sync",
    cells: [false, false, true, false, false],
  },
  {
    label: "Privacy gate (no-egress)",
    cells: [false, false, true, false, false],
  },
  {
    label: "Governed-agent kernel + sandboxed runner + tool-exec gate",
    cells: [false, false, false, true, false],
  },
];
