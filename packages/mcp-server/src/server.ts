// The buyer-facing MCP server core (ADR-0008/0004/0076), transport-agnostic: the
// @modelcontextprotocol/sdk stdio/SSE transport binds to `handleToolCall`. Auth is a timing-safe
// Bearer (per-buyer/license token); reads are entitlement-scoped; the one base write surface
// (`generate`) converges on the SAME registry index the CLI generator validates against (ADR-0021):
// every requested `{id, version}` is allowlist-checked (id AND version) BEFORE any entitlement check
// or host call, then the caller's purchases are entitlement-EXPANDED (ADR-0071: editions/bundle →
// member slugs) and every requested module-ownership is verified fail-closed. The server owns no DB
// tx — it validates + gates + MINTS the idempotency key (T21a: caller-supplied is reused verbatim so a
// true retry debits once), then delegates the credit debit + generation (ADR-0007/0024) to the host
// via `onGenerate` (which wires `runGeneration` inside `withTenant`).
//
// ADR-0076 turns the fixed tool set into an extension seam: tools are *registered*, not enumerated
// in a hard switch. Each registration declares the entitlement it requires; `handleToolCall`
// re-validates the caller's entitlement per tool in constant time, and a tool the caller is not
// entitled to is invisible — excluded from `listTools` and indistinguishable (404) from a tool
// that does not exist. Editions register their own buyer tools through `registerTool`.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AuthnError,
  CaissonError,
  EntitlementError,
  NotFoundError,
  ValidationError,
  parseStrict,
  safeEqualFixed,
  safeEqualVariable,
  strictObject,
} from "@caisson/kernel";
import {
  type RegistryIndex,
  EDITIONS,
  assertKnownModule,
  assertKnownVersion,
  expandEntitlements,
} from "@caisson/registry-schema";
import { registerCoachTools, type CoachOptions } from "./coach.ts";
import {
  registerManifestTools,
  type ManifestToolsOptions,
} from "./manifest-tools.ts";
import {
  registerCompliancePrompts,
  type CompliancePromptOptions,
} from "./compliance-prompts.ts";
import { registerRunTools, type RunToolsOptions } from "./run-tools.ts";

export interface BuyerToken {
  token: string;
  accountId: string;
  /** Module/edition slugs this buyer owns (entitlements, ADR-0010). */
  entitlements: string[];
}

export interface McpSession {
  accountId: string;
  entitlements: ReadonlySet<string>;
}

/** The validated, allowlist-gated selection the server hands the host — mirrors the CLI `Selection`
 *  (ADR-0048): a slug project name, an optional edition, and `{id, version}` modules. The host re-parses
 *  it through `Selection.parse` inside `runGeneration`, so this is the convergence contract, not a
 *  parallel shape. */
export interface GenerateSelection {
  projectName: string;
  edition?: string;
  modules: { id: string; version: string }[];
}

/** What `onGenerate` receives: the validated + entitlement-gated selection plus the idempotency key
 *  (minted by the server when the caller omits it; reused verbatim on a retry — T21a). The server owns
 *  no DB tx; the host wires `runGeneration` inside `withTenant` to debit-before-spend + write + record
 *  (ADR-0007/0024). */
export interface GenerateContext {
  accountId: string;
  selection: GenerateSelection;
  idempotencyKey: string;
}

/** What a tool handler receives: the authenticated caller's session and the raw tool args. */
export interface ToolHandlerContext {
  readonly session: McpSession;
  readonly args: unknown;
}

/**
 * The per-account abuse-throttle PORT (ADR-0112). An implementation throws `RateLimitError` (429)
 * when the account is over its limit, and resolves to allow. Defined here so the base mcp-server
 * package stays DB-free — `services/license` supplies the token-bucket-backed implementation; this
 * package only declares the seam and awaits it. By contract a thrown error is a DENY; the
 * implementation owns the fail-OPEN decision (a store fault must resolve, never throw — ADR-0112
 * lock 5), so the server treats a resolving hook as "allowed" without inspecting why.
 */
export type RateLimitHook = (accountId: string) => Promise<void>;

/**
 * One registered buyer-MCP tool (ADR-0076/0216). `requiredEntitlement` is the edition slug a
 * caller must own to *see* and *invoke* this tool; `null` marks a base tool visible to every
 * authenticated buyer. The entitlement is re-validated timing-safe on every call (ADR-0008/0010).
 * `description`/`version`/`audit` are the declarative manifest fields (ADR-0216): validated by
 * `toolManifestSchema` at registration time, not call time. `audit.logArgs` marks whether a call
 * to this tool is safe to log its arguments verbatim (`false` for every coach tool — secrets-safe
 * by construction, `coach.ts`; `true` for the 3 base tools, which take no secret-shaped args).
 */
export interface ToolRegistration {
  readonly name: string;
  readonly requiredEntitlement: string | null;
  readonly description: string;
  readonly version: string;
  readonly audit: { readonly logArgs: boolean };
  readonly handler: (ctx: ToolHandlerContext) => Promise<unknown>;
}

/** What a resource handler receives: the authenticated caller's session. Resources are
 *  addressed by URI, not args — a read carries no payload beyond the session it is served under. */
export interface ResourceHandlerContext {
  readonly session: McpSession;
}

/**
 * One registered readable resource, the resource-side mirror of `ToolRegistration`.
 * `requiredEntitlement` is the edition slug a caller must own to *see* and *read* this resource;
 * `null` marks a base resource visible to every authenticated buyer. The entitlement is re-validated
 * timing-safe on every read through the SAME `isEntitled` gate the tools use. `uri`/`name`/
 * `description`/`mimeType` are the declarative manifest fields, validated by `resourceManifestSchema`
 * at registration time (mirroring `toolManifestSchema`), not read time.
 */
export interface ResourceRegistration {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
  readonly requiredEntitlement: string | null;
  readonly handler: (ctx: ResourceHandlerContext) => Promise<unknown>;
}

/** One declared argument of a prompt. `required` gates whether a caller may omit it; the per-prompt
 *  args schema `getPrompt` builds from these rejects both a missing required arg and any undeclared
 *  extra arg (strict), consistent with every other boundary in this repo. */
export interface PromptArgSpec {
  readonly name: string;
  readonly description?: string;
  readonly required: boolean;
}

/** One message a prompt renders. Mirrors the MCP `PromptMessage` shape (role + text content) without
 *  importing the SDK into the transport-agnostic core — the transports return it verbatim. */
export interface PromptMessage {
  readonly role: "user" | "assistant";
  readonly content: { readonly type: "text"; readonly text: string };
}

/** What a prompt handler returns. Structurally the SDK `GetPromptResult` (optional description +
 *  messages); the transports hand it back to the client unchanged. */
export interface PromptResult {
  readonly description?: string;
  readonly messages: readonly PromptMessage[];
}

/** What a prompt handler receives: the authenticated caller's session and the validated args (a
 *  `Record<string,string>` per the MCP `prompts/get` contract — already parsed against the prompt's
 *  declared arguments, so unknown keys and missing-required args are rejected before the handler). */
export interface PromptHandlerContext {
  readonly session: McpSession;
  readonly args: Readonly<Record<string, string>>;
}

/**
 * One registered prompt, the prompt-side mirror of `ResourceRegistration`/`ToolRegistration`.
 * `requiredEntitlement` is the edition slug a caller must own to *see* and *get* this prompt; `null`
 * marks a base prompt visible to every authenticated buyer. The entitlement is re-validated
 * timing-safe on every get through the SAME `isEntitled` gate the tools/resources use.
 * `name`/`description`/`version`/`arguments` are the declarative manifest fields, validated by
 * `promptManifestSchema` at registration time (mirroring `toolManifestSchema`/`resourceManifestSchema`).
 */
export interface PromptRegistration {
  readonly name: string;
  readonly requiredEntitlement: string | null;
  readonly description: string;
  readonly version: string;
  readonly arguments: readonly PromptArgSpec[];
  readonly handler: (ctx: PromptHandlerContext) => Promise<PromptResult>;
}

/**
 * A deliberately-deprecated tool (ADR-0216). Distinct from "never existed": a retired name answers
 * `RetiredToolError` (410) with `reason`/`retiredAt`, so a buyer integration gets an actionable
 * signal instead of the same 404 an unknown tool gets.
 */
export interface RetiredTool {
  readonly name: string;
  readonly reason: string;
  readonly retiredAt: string;
}

/** Thrown by `handleToolCall` for a name on the retired-tools ledger (ADR-0216). */
export class RetiredToolError extends CaissonError {
  readonly code = "tool_retired";
  readonly httpStatus = 410;
  constructor(entry: RetiredTool) {
    super(`Tool retired: ${entry.name}`, {
      reason: entry.reason,
      retiredAt: entry.retiredAt,
    });
  }
}

export interface McpServerOptions {
  /** Issued buyer tokens (in prod: a DB lookup keyed by token hash). */
  tokens: readonly BuyerToken[];
  /**
   * The BUILT registry index (ADR-0021/0047) — the single source of truth the `generate` path
   * validates every requested `{id, version}` against (id AND version) and entitlement-expands the
   * caller's purchases through (ADR-0071). Converged with the CLI generator: the flat string allowlist
   * is gone, closing the divergent-from-CLI gap.
   */
  index: RegistryIndex;
  /**
   * Host hook that performs the credit debit + drives generation (ADR-0007/0024). The server hands it
   * the validated + entitlement-gated selection and the (minted-or-supplied) idempotency key; the host
   * wires `runGeneration` inside `withTenant` — the server itself owns no DB tx.
   */
  onGenerate: (ctx: GenerateContext) => Promise<{ generationId: string }>;
  /**
   * Opt-in ai-kit setup-coach tools (ADR-0076 seam + ADR-0011). When present, the four
   * entitlement-gated, secrets-safe coach tools are registered through `registerTool`; when
   * omitted no coach tool exists (fail-closed). See `coach.ts`.
   */
  coach?: CoachOptions;
  /**
   * Opt-in agent-ready design-system tools (ADR-0330/ADR-0345). When present, the base
   * list_components/describe_component/get_tokens read tools plus the entitlement-gated check_usage
   * doctor (and, if a pro manifest is supplied, describe_pro_component) are registered through the
   * same seam; when omitted no design-system tool exists (fail-closed). See `manifest-tools.ts`.
   */
  dsManifest?: ManifestToolsOptions;
  /**
   * Optional server-side per-account rate-limit gate (ADR-0112). When present it is AWAITED before
   * EVERY tool dispatch (base or edition) — a buyer over their limit is blocked with `RateLimitError`
   * (429) before reaching any handler, so one licensed caller cannot exhaust shared capacity. When
   * omitted the server runs UNTHROTTLED (the default contract — backward-compatible). The hook owns
   * the fail-OPEN policy (ADR-0112 lock 5): a store fault resolves (allow + alert), only a genuine
   * deny throws. `services/license` provides the token-bucket-backed implementation.
   */
  checkRateLimit?: RateLimitHook;
  /**
   * Opt-in compliance-edition prompt (`compliance_evidence_walkthrough`). When present the prompt is
   * registered through the same seam, gated on the `compliance` entitlement by default; when omitted
   * no compliance prompt exists (fail-closed). See `compliance-prompts.ts`.
   */
  compliancePrompts?: CompliancePromptOptions;
  /**
   * Opt-in agent-runtime tools (ADR-0360 S5, ADR-0361/0362). When present, `run_start`/`run_status`
   * are registered through the same seam, gated on the module's OWN dedicated entitlement (default
   * `"@caisson/agent-trajectory"`, never the Agentic-Dev bundle's fold slug); when omitted neither
   * tool exists (fail-closed). The actual loop/store wiring is the HOST's `@caisson/ai-kit`
   * `buildRunTools` callback pair (injected, mirrors `onGenerate` — this open package never imports
   * the commercial edition at runtime). See `run-tools.ts`.
   */
  runTools?: RunToolsOptions;
}

export interface McpServer {
  authenticate(bearer: string): McpSession;
  /**
   * Register an additional (edition) tool. Validates the declarative manifest fields
   * (`description`/`version`/`audit`, ADR-0216) BEFORE the duplicate-name guard, then throws on a
   * duplicate name (fail-closed) so an edition can never silently shadow a base or peer tool.
   */
  registerTool(registration: ToolRegistration): void;
  /**
   * Append-only: retire a currently-registered tool name (ADR-0216). Throws `ValidationError` if
   * the name is already retired OR still active in the registry (never both — a name is exactly
   * one of active/retired/unknown). No `unretireTool` — retirement is a one-way lifecycle fact.
   */
  retireTool(entry: RetiredTool): void;
  /** The tools VISIBLE to this caller: base tools + only the edition tools they're entitled to. */
  listTools(session: McpSession): readonly ToolRegistration[];
  handleToolCall(
    session: McpSession,
    tool: string,
    args: unknown,
  ): Promise<unknown>;
  /**
   * Register a readable resource. Mirrors `registerTool`: the manifest fields
   * (`uri`/`name`/`description`/`mimeType`) are validated at registration time, then a duplicate URI
   * is a fail-closed `ValidationError` — a resource can never silently shadow a peer.
   */
  registerResource(registration: ResourceRegistration): void;
  /** The resources VISIBLE to this caller: base resources + only the entitled edition ones. */
  listResources(session: McpSession): readonly ResourceRegistration[];
  /**
   * Read one resource by URI. Enforces the SAME invisible-entitlement contract as `handleToolCall`
   * (an unregistered URI and a URI the caller is not entitled to are the identical 404) and awaits
   * `options.checkRateLimit` before serving.
   */
  readResource(session: McpSession, uri: string): Promise<unknown>;
  /**
   * Register a prompt. Mirrors `registerTool`/`registerResource`: the manifest fields
   * (`name`/`description`/`version`/`arguments`) are validated at registration time, then a
   * duplicate name is a fail-closed `ValidationError` — a prompt can never silently shadow a peer.
   */
  registerPrompt(registration: PromptRegistration): void;
  /** The prompts VISIBLE to this caller: base prompts + only the entitled edition ones. */
  listPrompts(session: McpSession): readonly PromptRegistration[];
  /**
   * Get one prompt by name. Enforces the SAME invisible-entitlement contract as `readResource`
   * (an unregistered name and a name the caller is not entitled to are the identical 404, checked
   * BEFORE the rate-limit gate), awaits `options.checkRateLimit`, then validates `rawArgs` against
   * the prompt's declared arguments (strict — missing-required and unknown-extra both rejected)
   * before invoking the handler.
   */
  getPrompt(
    session: McpSession,
    name: string,
    rawArgs: Record<string, string>,
  ): Promise<PromptResult>;
}

// The `modules` array ceiling (b719aff8). Enforced TWICE: an O(1) raw-length pre-guard in the
// `generate` handler runs BEFORE `parseStrict`, and the Zod `.max()` below re-asserts the shape
// contract. Both are needed because Zod's `.array(elem).max(N)` parses EVERY element before the
// `.max` check fires (verified on zod 3.25.x) — so `.max` alone cannot stop an oversized array from
// running the element parse O(N) times and blocking the shared event loop. Far above the ~32-module
// registry (the CLI also dedups ids at Selection.parse); raise if the catalog grows past it.
const MAX_MODULES = 100;

// The declarative per-tool manifest (ADR-0216): validated in `registerTool()` before the
// duplicate-name guard, so a bad manifest is a registration-time `ValidationError`, never a
// call-time surprise. `version` is bare semver (no leading `v`, no pre-release/build metadata —
// this is a manifest label, not a published package version).
const toolManifestSchema = strictObject({
  description: z.string().min(1).max(280),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be a semver x.y.z"),
  audit: strictObject({ logArgs: z.boolean() }),
});

// The declarative per-resource manifest, the mirror of `toolManifestSchema`: validated
// in `registerResource()` before the duplicate-URI guard, so a bad manifest is a registration-time
// `ValidationError`. The `uri` is a stable `caisson://<path>` scheme (documented in the README) — a
// registration-time shape guard on code-supplied URIs, not an untrusted-input gate.
const resourceManifestSchema = strictObject({
  uri: z
    .string()
    .regex(/^caisson:\/\/[a-z0-9/-]+$/, "must be a caisson:// URI"),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(280),
  mimeType: z.string().min(1).max(120),
});

// The declarative per-prompt manifest, the prompt-side mirror of `resourceManifestSchema`: validated
// in `registerPrompt()` before the duplicate-name guard, so a bad manifest is a registration-time
// `ValidationError`. `name`/`arguments[].name` are code-supplied slugs (a registration-time shape
// guard, not an untrusted-input gate); the caller's actual args are re-validated per-get against a
// schema built from `arguments`.
const PROMPT_NAME = z
  .string()
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "must be a lower_snake slug");
const promptManifestSchema = strictObject({
  name: PROMPT_NAME,
  description: z.string().min(1).max(280),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be a semver x.y.z"),
  arguments: z
    .array(
      strictObject({
        name: PROMPT_NAME,
        description: z.string().min(1).max(200).optional(),
        required: z.boolean(),
      }),
    )
    .max(10),
});

// `.max(128)` = the repo module-id bound (PurchasedIds in registry-schema); `name` is a module slug.
const describeArgs = strictObject({ name: z.string().min(1).max(128) });
const generateArgs = strictObject({
  // A strict lowercase slug — it becomes the buyer's project directory at write time (no traversal),
  // and re-parses cleanly through the CLI `Selection` schema in `runGeneration`.
  projectName: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "must be a lowercase slug"),
  // Optional edition hint (drives the generator's ADR-0077 member-pin fold); entitlement is checked
  // per-module against the expanded set, not on this field.
  edition: z.enum(EDITIONS).optional(),
  // `{id, version}` modules (converged with the CLI generator) — never bare strings. `assertKnownModule`
  // re-asserts the slug regex as defense-in-depth, so a loose string here is gated downstream. Each
  // string is bounded HERE (`id` = the repo module-id bound, 128; `version` covers semver + tags). The
  // `.max(MAX_MODULES)` bounds the SHAPE but is NOT the DoS guard — Zod parses every element before the
  // cap fires, so the array LENGTH is guarded O(1) in the handler BEFORE `parseStrict` runs (b719aff8).
  modules: z
    .array(
      strictObject({
        id: z.string().min(1).max(128),
        version: z.string().min(1).max(64),
      }),
    )
    .min(1)
    .max(MAX_MODULES),
  // Caller-supplied idempotency key (a true retry reuses it → debit-once). Minted when omitted.
  idempotencyKey: z.string().uuid().optional(),
});

export function createMcpServer(options: McpServerOptions): McpServer {
  const registry = new Map<string, ToolRegistration>();
  // Append-only retirement ledger (ADR-0216): per-server-instance, same seeding pattern as
  // `registry` — no new persistence surface. A name is exactly one of active/retired/unknown.
  const retiredTools = new Map<string, RetiredTool>();
  // The parallel RESOURCE registry, the read-side mirror of `registry`. Same
  // per-instance seeding, same entitlement gate (`isEntitled` below), same invisible-not-found
  // contract. No retirement ledger — resources have no deprecation lifecycle in this slice.
  const resources = new Map<string, ResourceRegistration>();
  // The parallel PROMPT registry, the prompt-side mirror of `registry`/`resources`. Same
  // per-instance seeding, same entitlement gate, same invisible-not-found contract. No retirement
  // ledger — prompts have no deprecation lifecycle in this slice (mirrors resources).
  const prompts = new Map<string, PromptRegistration>();

  /**
   * Constant-time entitlement gate. A base tool (`required === null`) is always entitled; an
   * edition tool scans every owned entitlement with no early return, comparing the slug timing-safe
   * (variable-length: hash-then-compare) so neither a match nor its position leaks via timing.
   */
  function isEntitled(session: McpSession, required: string | null): boolean {
    if (required === null) return true;
    let ok = false;
    for (const owned of session.entitlements) {
      if (safeEqualVariable(owned, required)) ok = true;
    }
    return ok;
  }

  function registerTool(registration: ToolRegistration): void {
    // Manifest validation (ADR-0216) runs BEFORE the duplicate-name guard, so a malformed manifest
    // is a registration-time `ValidationError` regardless of whether the name collides.
    parseStrict(toolManifestSchema, {
      description: registration.description,
      version: registration.version,
      audit: registration.audit,
    });
    if (registry.has(registration.name)) {
      throw new ValidationError(
        `Tool already registered: ${registration.name}`,
        {
          tool: registration.name,
        },
      );
    }
    registry.set(registration.name, registration);
  }

  function retireTool(entry: RetiredTool): void {
    // Fail-closed, mirrors `registerTool`'s shape: a name is exactly one of active/retired/unknown
    // — never both active and retired, never retired twice (no `unretireTool`, append-only).
    if (retiredTools.has(entry.name)) {
      throw new ValidationError(`Tool already retired: ${entry.name}`, {
        tool: entry.name,
      });
    }
    if (registry.has(entry.name)) {
      throw new ValidationError(
        `Cannot retire a currently-active tool: ${entry.name}`,
        { tool: entry.name },
      );
    }
    retiredTools.set(entry.name, entry);
  }

  function authenticate(bearer: string): McpSession {
    // Compare against every token in constant time (no early return) before deciding.
    let matched: BuyerToken | undefined;
    for (const t of options.tokens) {
      if (safeEqualFixed(bearer, t.token)) matched = t;
    }
    if (matched === undefined) throw new AuthnError("Invalid MCP token");
    return {
      accountId: matched.accountId,
      entitlements: new Set(matched.entitlements),
    };
  }

  function listTools(session: McpSession): readonly ToolRegistration[] {
    return [...registry.values()]
      .filter((reg) => isEntitled(session, reg.requiredEntitlement))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function handleToolCall(
    session: McpSession,
    tool: string,
    args: unknown,
  ): Promise<unknown> {
    const registration = registry.get(tool);
    // An unregistered tool — and a tool the caller is not entitled to — are both 404: the edition
    // tool is invisible, never leaking that it exists to a non-entitled caller. A RETIRED name is
    // checked first (ADR-0216): distinct from "never existed" so a buyer integration gets a
    // reason, not the same bare 404 an unknown tool gets.
    if (
      registration === undefined ||
      !isEntitled(session, registration.requiredEntitlement)
    ) {
      const retired = retiredTools.get(tool);
      if (retired !== undefined) throw new RetiredToolError(retired);
      throw new NotFoundError(`Unknown tool: ${tool}`);
    }
    // Abuse-throttle gate (ADR-0112): awaited before dispatching ANY tool — base or edition. A
    // genuine deny throws RateLimitError (429) and the handler never runs; a store fault resolves
    // (fail-OPEN, decided in the hook) so a paying buyer is never locked out by infrastructure.
    // Absent hook ⇒ unthrottled, the default backward-compatible contract.
    if (options.checkRateLimit !== undefined) {
      await options.checkRateLimit(session.accountId);
    }
    return registration.handler({ session, args });
  }

  // --- Resources: the read-side mirror of the tool registry above, reusing the same
  //     `isEntitled` gate and `options.checkRateLimit` hook. ---

  function registerResource(registration: ResourceRegistration): void {
    // Manifest validation mirrors `registerTool`: a malformed manifest is a registration-time
    // `ValidationError`, checked BEFORE the duplicate-URI guard.
    parseStrict(resourceManifestSchema, {
      uri: registration.uri,
      name: registration.name,
      description: registration.description,
      mimeType: registration.mimeType,
    });
    if (resources.has(registration.uri)) {
      throw new ValidationError(
        `Resource already registered: ${registration.uri}`,
        { uri: registration.uri },
      );
    }
    resources.set(registration.uri, registration);
  }

  function listResources(session: McpSession): readonly ResourceRegistration[] {
    return [...resources.values()]
      .filter((reg) => isEntitled(session, reg.requiredEntitlement))
      .sort((a, b) => a.uri.localeCompare(b.uri));
  }

  async function readResource(
    session: McpSession,
    uri: string,
  ): Promise<unknown> {
    const registration = resources.get(uri);
    // Invisible-resource contract (mirrors `handleToolCall`): an unregistered URI AND a URI the
    // caller is not entitled to are BOTH a 404 — an entitlement-gated resource never leaks that it
    // exists. Checked BEFORE the rate-limit gate, so a 404 never consumes a caller's throttle.
    if (
      registration === undefined ||
      !isEntitled(session, registration.requiredEntitlement)
    ) {
      throw new NotFoundError(`Unknown resource: ${uri}`);
    }
    // Same abuse-throttle gate as `handleToolCall` (ADR-0112): awaited before serving any read.
    if (options.checkRateLimit !== undefined) {
      await options.checkRateLimit(session.accountId);
    }
    return registration.handler({ session });
  }

  // --- Prompts: the prompt-side mirror of the tool/resource registries above, reusing the same
  //     `isEntitled` gate and `options.checkRateLimit` hook. ---

  function registerPrompt(registration: PromptRegistration): void {
    // Manifest validation mirrors `registerTool`/`registerResource`: a malformed manifest is a
    // registration-time `ValidationError`, checked BEFORE the duplicate-name guard.
    parseStrict(promptManifestSchema, {
      name: registration.name,
      description: registration.description,
      version: registration.version,
      arguments: registration.arguments,
    });
    if (prompts.has(registration.name)) {
      throw new ValidationError(
        `Prompt already registered: ${registration.name}`,
        { prompt: registration.name },
      );
    }
    prompts.set(registration.name, registration);
  }

  function listPrompts(session: McpSession): readonly PromptRegistration[] {
    return [...prompts.values()]
      .filter((reg) => isEntitled(session, reg.requiredEntitlement))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function getPrompt(
    session: McpSession,
    name: string,
    rawArgs: Record<string, string>,
  ): Promise<PromptResult> {
    const registration = prompts.get(name);
    // Invisible-prompt contract (mirrors `readResource`): an unregistered name AND a name the caller
    // is not entitled to are BOTH a 404 — an entitlement-gated prompt never leaks that it exists.
    // Checked BEFORE the rate-limit gate, so a 404 never consumes a caller's throttle.
    if (
      registration === undefined ||
      !isEntitled(session, registration.requiredEntitlement)
    ) {
      throw new NotFoundError(`Unknown prompt: ${name}`);
    }
    // Same abuse-throttle gate as `handleToolCall`/`readResource` (ADR-0112): awaited before the
    // handler runs — but AFTER the invisible-404, so a not-found never burns throttle.
    if (options.checkRateLimit !== undefined) {
      await options.checkRateLimit(session.accountId);
    }
    // Build the per-prompt strict args schema from the declared arguments (each `z.string()`,
    // `.optional()` unless required) and validate the caller's `Record<string,string>` against it —
    // rejecting both a missing-required arg and any undeclared extra key (strict), consistent with
    // every other boundary in this repo.
    const shape: Record<string, z.ZodTypeAny> = {};
    for (const arg of registration.arguments) {
      // .max(512) — bound strings at the boundary like every tool arg in this package.
      const base = z.string().max(512);
      shape[arg.name] = arg.required ? base : base.optional();
    }
    const parsed = parseStrict(strictObject(shape), rawArgs) as Record<
      string,
      string
    >;
    return registration.handler({ session, args: parsed });
  }

  // --- Base tools (ADR-0008): visible to every authenticated buyer, no edition entitlement. ---

  registerTool({
    name: "list_modules",
    requiredEntitlement: null,
    description: "List the module/edition slugs this buyer is entitled to.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async ({ session }) => ({
      modules: [...session.entitlements].sort(),
    }),
  });

  registerTool({
    name: "describe_module",
    requiredEntitlement: null,
    description: "Describe a single entitled module by slug.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async ({ session, args }) => {
      const { name } = parseStrict(describeArgs, args);
      if (!session.entitlements.has(name)) {
        throw new EntitlementError(`Not entitled to module: ${name}`);
      }
      return {
        name,
        summary: `Module ${name} — conventions available to entitled buyers.`,
      };
    },
  });

  registerTool({
    name: "generate",
    requiredEntitlement: null,
    description:
      "Generate a project from a registry-allowlisted, entitlement-gated module selection.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async ({ session, args }) => {
      // DoS pre-guard (b719aff8): Zod's `.array().max(MAX_MODULES)` parses EVERY element before the
      // cap check fires, so an oversized `modules` array would run the element parse O(N) times and
      // block the shared event loop inside `parseStrict`. Reject on the RAW array length first —
      // O(1), no per-element parse — so an over-cap request is a flat-cost 400. Runs for every
      // transport (stdio + HTTP), since all `generate` calls route through this handler.
      const rawModules =
        typeof args === "object" && args !== null
          ? (args as { modules?: unknown }).modules
          : undefined;
      if (Array.isArray(rawModules) && rawModules.length > MAX_MODULES) {
        throw new ValidationError("Too many modules requested", {
          max: MAX_MODULES,
        });
      }
      const input = parseStrict(generateArgs, args);
      // 1) Registry allowlist (ADR-0021/0004): every `{id, version}` must resolve in the BUILT index —
      //    id AND version, the same gate the CLI generator runs (closes the divergent flat-allowlist
      //    gap). `assertKnownModule`/`assertKnownVersion` throw a raw Error on a miss; surface it as a
      //    400 ValidationError (anti-injection), thrown BEFORE any entitlement check, mint, or host call.
      for (const m of input.modules) {
        try {
          assertKnownModule(options.index, m.id);
          assertKnownVersion(options.index, m.id, m.version);
        } catch {
          throw new ValidationError("Unknown registry module or version", {
            module: `${m.id}@${m.version}`,
          });
        }
      }
      // 2) Entitlement (ADR-0071/0076): EXPAND the caller's purchases (editions/bundle → member slugs)
      //    and require ownership of every requested module id — fail-closed, BEFORE the host call. Module
      //    slugs are PUBLIC catalog ids, so ownership is a plain set membership (the timing-safe compare
      //    is the per-tool gate above, ADR-0076; see registry/schema/entitlements.ts on why no
      //    timingSafeEqual here).
      const owned = expandEntitlements(options.index, [
        ...session.entitlements,
      ]);
      const notEntitled = input.modules
        .map((m) => m.id)
        .filter((id) => !owned.has(id));
      if (notEntitled.length > 0) {
        throw new EntitlementError(
          `Not entitled to: ${notEntitled.join(", ")}`,
          {
            notEntitled,
          },
        );
      }
      // 3) Idempotency (T21a): mint a fresh UUID when the caller omits one; a caller-supplied key is
      //    reused VERBATIM so a true retry flows through to `runGeneration`'s debit-once dedup (ADR-0024).
      const idempotencyKey = input.idempotencyKey ?? randomUUID();
      // 4) The server owns no DB tx — it validated + gated + minted, now it delegates. The host wires
      //    `runGeneration` inside `withTenant` (debit-before-spend + write + audit row, ADR-0007/0024).
      return options.onGenerate({
        accountId: session.accountId,
        selection: {
          projectName: input.projectName,
          ...(input.edition !== undefined ? { edition: input.edition } : {}),
          modules: input.modules.map((m) => ({ id: m.id, version: m.version })),
        },
        idempotencyKey,
      });
    },
  });

  // --- Base resources: visible to every authenticated buyer, no edition entitlement.

  // The full registry catalog as a resource (operator lock 2026-07-17: expose the FULL index
  // as-held — discovery is the point; prices/tiers are already public marketing data). The Bearer
  // gate still fronts it; `requiredEntitlement: null` means any authenticated buyer, not anonymous.
  registerResource({
    uri: "caisson://registry/index",
    name: "Caisson registry index",
    description:
      "The full Caisson module registry catalog (modules, versions, tiers, prices) as JSON.",
    mimeType: "application/json",
    requiredEntitlement: null,
    handler: async () => options.index,
  });

  // --- Base prompts: visible to every authenticated buyer, no edition entitlement.

  // integrate_module: narrate the describe_module → generate recipe for one owned module. Validates
  // `moduleId` against the live registry index up front (mirroring `generate`'s allowlist), so the
  // prompt can never recommend a module the generator would reject.
  registerPrompt({
    name: "integrate_module",
    requiredEntitlement: null,
    description:
      "Walk through adding one purchased Caisson module to a project: describe it, then generate.",
    version: "1.0.0",
    arguments: [
      {
        name: "module_id",
        description: "The @caisson/<slug> module to integrate.",
        required: true,
      },
      {
        name: "version",
        description: "A specific module version (defaults to latest).",
        required: false,
      },
      {
        name: "project_name",
        description: "The target project slug (default my-app).",
        required: false,
      },
    ],
    handler: async ({ args }) => {
      // `module_id` is a required arg → always present at runtime (getPrompt validates it); the `??`
      // only satisfies noUncheckedIndexedAccess. An empty id fails assertKnownModule → 400 anyway.
      const moduleId = args.module_id ?? "";
      try {
        assertKnownModule(options.index, moduleId);
        if (args.version !== undefined) {
          assertKnownVersion(options.index, moduleId, args.version);
        }
      } catch {
        throw new ValidationError("Unknown registry module or version", {
          module:
            args.version !== undefined
              ? `${moduleId}@${args.version}`
              : moduleId,
        });
      }
      // Resolve to a CONCRETE version: `generate` validates via assertKnownVersion, which only
      // accepts members of entry.versions — the literal string "latest" is an index pointer and
      // would 400. Same resolution the CLI does before its own generate call.
      const entry = options.index.modules.find((m) => m.id === moduleId);
      if (entry === undefined) {
        throw new ValidationError("Unknown registry module or version", {
          module: moduleId,
        });
      }
      const version = args.version ?? entry.latest;
      const projectName = args.project_name ?? "my-app";
      const versionLine =
        args.version !== undefined
          ? `"${args.version}"`
          : `"${entry.latest}" (the current latest; pin any published version instead if needed)`;
      const text = [
        `Integrate ${moduleId} into the "${projectName}" project.`,
        "",
        `1. Inspect the module first — call the describe_module tool with { "name": "${moduleId}" } to confirm you are entitled to it and read its summary.`,
        "",
        "2. Generate the project scaffold — call the generate tool:",
        JSON.stringify(
          {
            projectName,
            modules: [{ id: moduleId, version }],
          },
          null,
          2,
        ),
        `   (use ${versionLine} for the module version).`,
        "",
        "generate validates every requested module against the registry allowlist and your entitlements, then debits credits and writes the scaffold in one idempotent step.",
      ].join("\n");
      return {
        description: `Integration recipe for ${moduleId}`,
        messages: [{ role: "user", content: { type: "text", text } }],
      };
    },
  });

  const server: McpServer = {
    authenticate,
    registerTool,
    retireTool,
    listTools,
    handleToolCall,
    registerResource,
    listResources,
    readResource,
    registerPrompt,
    listPrompts,
    getPrompt,
  };
  // ADR-0076 wire: the coach is just an edition registering its tools through the seam.
  if (options.coach) registerCoachTools(server, options.coach);
  // ADR-0330/0345 wire: the design-system tools (and their resource front) register
  // through the same seam, same one-way flow.
  if (options.dsManifest) registerManifestTools(server, options.dsManifest);
  // Compliance-edition prompt registers through the same seam, same one-way flow.
  if (options.compliancePrompts)
    registerCompliancePrompts(server, options.index, options.compliancePrompts);
  // ADR-0360 S5 / ADR-0361/0362 wire: run_start/run_status register through the same seam, same
  // one-way flow — the injected host callbacks are the ONLY commercial-tier coupling.
  if (options.runTools) registerRunTools(server, options.runTools);
  return server;
}
