// The MCP server core (ADR-0008/0004/0076), transport-agnostic: the @modelcontextprotocol/sdk
// stdio/SSE transport binds to `handleToolCall`. Auth is a timing-safe Bearer token checked on
// every session; every registered tool, resource and prompt is visible to every authenticated
// caller. The one base write surface (`generate`) converges on the SAME registry index the CLI
// generator validates against (ADR-0021): every requested `{id, version}` is catalog-checked (id AND
// version) BEFORE the host call. The server owns no DB tx — it validates, then delegates generation
// to the host via `onGenerate`.
//
// ADR-0076 turns the fixed tool set into an extension seam: tools are *registered*, not enumerated
// in a hard switch. Optional kits register their own tools through `registerTool`.
import { z } from "zod";
import {
  AuthnError,
  CaissonError,
  NotFoundError,
  ValidationError,
  parseStrict,
  safeEqualFixed,
  strictObject,
} from "@caisson/kernel/node";
import {
  type RegistryIndex,
  assertKnownModule,
  assertKnownVersion,
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

/** One issued Bearer token and the account it authenticates. */
export interface BuyerToken {
  token: string;
  accountId: string;
}

export interface McpSession {
  accountId: string;
}

/** The validated, catalog-checked selection the server hands the host — mirrors the CLI `Selection`
 *  (ADR-0048): a slug project name and `{id, version}` modules. The host re-parses it through the CLI
 *  `Selection` schema, so this is the convergence contract, not a parallel shape. */
export interface GenerateSelection {
  projectName: string;
  modules: { id: string; version: string }[];
}

/** What `onGenerate` receives: the authenticated account plus the validated selection. The server
 *  owns no DB tx; the host generates and writes. */
export interface GenerateContext {
  accountId: string;
  selection: GenerateSelection;
}

/** What a tool handler receives: the authenticated caller's session and the raw tool args. */
export interface ToolHandlerContext {
  readonly session: McpSession;
  readonly args: unknown;
}

/**
 * The per-account abuse-throttle PORT (ADR-0112). An implementation throws `RateLimitError` (429)
 * when the account is over its limit, and resolves to allow. Defined here so the mcp-server
 * package stays DB-free — the host supplies the implementation (for example a token bucket over
 * `@caisson/rate-limit`); this package only declares the seam and awaits it. By contract a thrown error is a DENY; the
 * implementation owns the fail-OPEN decision (a store fault must resolve, never throw — ADR-0112
 * lock 5), so the server treats a resolving hook as "allowed" without inspecting why.
 */
export type RateLimitHook = (accountId: string) => Promise<void>;

/**
 * One registered MCP tool (ADR-0076/0216), visible to every authenticated caller.
 * `description`/`version`/`audit` are the declarative manifest fields (ADR-0216): validated by
 * `toolManifestSchema` at registration time, not call time. `audit.logArgs` marks whether a call
 * to this tool is safe to log its arguments verbatim (`false` for every coach tool — secrets-safe
 * by construction, `coach.ts`; `true` for the 3 base tools, which take no secret-shaped args).
 */
export interface ToolRegistration {
  readonly name: string;
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
 * One registered readable resource, the resource-side mirror of `ToolRegistration`, visible to
 * every authenticated caller. `uri`/`name`/`description`/`mimeType` are the declarative manifest
 * fields, validated by `resourceManifestSchema` at registration time (mirroring
 * `toolManifestSchema`), not read time.
 */
export interface ResourceRegistration {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
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
 * One registered prompt, the prompt-side mirror of `ResourceRegistration`/`ToolRegistration`,
 * visible to every authenticated caller. `name`/`description`/`version`/`arguments` are the
 * declarative manifest fields, validated by `promptManifestSchema` at registration time (mirroring
 * `toolManifestSchema`/`resourceManifestSchema`).
 */
export interface PromptRegistration {
  readonly name: string;
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
   * validates every requested `{id, version}` against (id AND version), converged with the CLI
   * generator.
   */
  index: RegistryIndex;
  /**
   * Host hook that drives generation. The server hands it the authenticated account and the
   * validated selection — the server itself owns no DB tx.
   */
  onGenerate: (ctx: GenerateContext) => Promise<{ generationId: string }>;
  /**
   * Opt-in ai-kit setup-coach tools (ADR-0076 seam + ADR-0011). When present, the four
   * secrets-safe coach tools are registered through `registerTool`; when omitted no coach tool
   * exists. See `coach.ts`.
   */
  coach?: CoachOptions;
  /**
   * Opt-in agent-ready design-system tools (ADR-0330/ADR-0345). When present, the
   * list_components/describe_component/get_tokens read tools plus the check_usage doctor (and, if a
   * pro manifest is supplied, describe_pro_component) are registered through the same seam; when
   * omitted no design-system tool exists. See `manifest-tools.ts`.
   */
  dsManifest?: ManifestToolsOptions;
  /**
   * Optional server-side per-account rate-limit gate (ADR-0112). When present it is AWAITED before
   * EVERY tool dispatch — a caller over their limit is blocked with `RateLimitError` (429) before
   * reaching any handler, so one caller cannot exhaust shared capacity. When omitted the server runs
   * UNTHROTTLED (the default contract — backward-compatible). The hook owns the fail-OPEN policy
   * (ADR-0112 lock 5): a store fault resolves (allow + alert), only a genuine deny throws.
   */
  checkRateLimit?: RateLimitHook;
  /**
   * Opt-in compliance prompt (`compliance_evidence_walkthrough`). When present the prompt is
   * registered through the same seam; when omitted no compliance prompt exists. See
   * `compliance-prompts.ts`.
   */
  compliancePrompts?: CompliancePromptOptions;
  /**
   * Opt-in agent-runtime tools (ADR-0360 S5, ADR-0361/0362). When present, `run_start`/`run_status`
   * are registered through the same seam; when omitted neither tool exists. The actual loop/store
   * wiring is the HOST's `@caisson/ai-kit` `buildRunTools` callback pair (injected, mirrors
   * `onGenerate` — this package never imports ai-kit at runtime). See `run-tools.ts`.
   */
  runTools?: RunToolsOptions;
}

export interface McpServer {
  authenticate(bearer: string): McpSession;
  /**
   * Register an additional tool. Validates the declarative manifest fields
   * (`description`/`version`/`audit`, ADR-0216) BEFORE the duplicate-name guard, then throws on a
   * duplicate name (fail-closed) so a kit can never silently shadow a base or peer tool.
   */
  registerTool(registration: ToolRegistration): void;
  /**
   * Append-only: retire a currently-registered tool name (ADR-0216). Throws `ValidationError` if
   * the name is already retired OR still active in the registry (never both — a name is exactly
   * one of active/retired/unknown). No `unretireTool` — retirement is a one-way lifecycle fact.
   */
  retireTool(entry: RetiredTool): void;
  /** Every registered tool, sorted by name. */
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
  /** Every registered resource, sorted by URI. */
  listResources(session: McpSession): readonly ResourceRegistration[];
  /**
   * Read one resource by URI. An unregistered URI is a 404; otherwise awaits
   * `options.checkRateLimit` before serving.
   */
  readResource(session: McpSession, uri: string): Promise<unknown>;
  /**
   * Register a prompt. Mirrors `registerTool`/`registerResource`: the manifest fields
   * (`name`/`description`/`version`/`arguments`) are validated at registration time, then a
   * duplicate name is a fail-closed `ValidationError` — a prompt can never silently shadow a peer.
   */
  registerPrompt(registration: PromptRegistration): void;
  /** Every registered prompt, sorted by name. */
  listPrompts(session: McpSession): readonly PromptRegistration[];
  /**
   * Get one prompt by name. An unregistered name is a 404 (checked BEFORE the rate-limit gate);
   * otherwise awaits `options.checkRateLimit`, then validates `rawArgs` against the prompt's
   * declared arguments (strict — missing-required and unknown-extra both rejected) before invoking
   * the handler.
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

// `.max(128)` = the repo module-id bound; `name` is a module id.
const describeArgs = strictObject({ name: z.string().min(1).max(128) });
const generateArgs = strictObject({
  // A strict lowercase slug — it becomes the project directory at write time (no traversal), and
  // re-parses cleanly through the CLI `Selection` schema.
  projectName: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "must be a lowercase slug"),
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
});

export function createMcpServer(options: McpServerOptions): McpServer {
  const registry = new Map<string, ToolRegistration>();
  // Append-only retirement ledger (ADR-0216): per-server-instance, same seeding pattern as
  // `registry` — no new persistence surface. A name is exactly one of active/retired/unknown.
  const retiredTools = new Map<string, RetiredTool>();
  // The parallel RESOURCE registry, the read-side mirror of `registry`. Same per-instance seeding,
  // same not-found contract. No retirement ledger — resources have no deprecation lifecycle.
  const resources = new Map<string, ResourceRegistration>();
  // The parallel PROMPT registry, the prompt-side mirror of `registry`/`resources`. Same
  // per-instance seeding, same not-found contract. No retirement ledger (mirrors resources).
  const prompts = new Map<string, PromptRegistration>();

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
    return { accountId: matched.accountId };
  }

  function listTools(_session: McpSession): readonly ToolRegistration[] {
    return [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function handleToolCall(
    session: McpSession,
    tool: string,
    args: unknown,
  ): Promise<unknown> {
    const registration = registry.get(tool);
    // An unregistered tool is a 404. A RETIRED name is checked first (ADR-0216): distinct from
    // "never existed" so an integration gets a reason, not the same bare 404 an unknown tool gets.
    if (registration === undefined) {
      const retired = retiredTools.get(tool);
      if (retired !== undefined) throw new RetiredToolError(retired);
      throw new NotFoundError(`Unknown tool: ${tool}`);
    }
    // Abuse-throttle gate (ADR-0112): awaited before dispatching ANY tool. A genuine deny throws
    // RateLimitError (429) and the handler never runs; a store fault resolves (fail-OPEN, decided in
    // the hook) so a caller is never locked out by infrastructure. Absent hook ⇒ unthrottled, the
    // default backward-compatible contract.
    if (options.checkRateLimit !== undefined) {
      await options.checkRateLimit(session.accountId);
    }
    return registration.handler({ session, args });
  }

  // --- Resources: the read-side mirror of the tool registry above, reusing the same
  //     `options.checkRateLimit` hook. ---

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

  function listResources(
    _session: McpSession,
  ): readonly ResourceRegistration[] {
    return [...resources.values()].sort((a, b) => a.uri.localeCompare(b.uri));
  }

  async function readResource(
    session: McpSession,
    uri: string,
  ): Promise<unknown> {
    const registration = resources.get(uri);
    // An unregistered URI is a 404, checked BEFORE the rate-limit gate so a 404 never consumes a
    // caller's throttle.
    if (registration === undefined) {
      throw new NotFoundError(`Unknown resource: ${uri}`);
    }
    // Same abuse-throttle gate as `handleToolCall` (ADR-0112): awaited before serving any read.
    if (options.checkRateLimit !== undefined) {
      await options.checkRateLimit(session.accountId);
    }
    return registration.handler({ session });
  }

  // --- Prompts: the prompt-side mirror of the tool/resource registries above, reusing the same
  //     `options.checkRateLimit` hook. ---

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

  function listPrompts(_session: McpSession): readonly PromptRegistration[] {
    return [...prompts.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function getPrompt(
    session: McpSession,
    name: string,
    rawArgs: Record<string, string>,
  ): Promise<PromptResult> {
    const registration = prompts.get(name);
    // An unregistered name is a 404, checked BEFORE the rate-limit gate so a 404 never consumes a
    // caller's throttle (mirrors `readResource`).
    if (registration === undefined) {
      throw new NotFoundError(`Unknown prompt: ${name}`);
    }
    // Same abuse-throttle gate as `handleToolCall`/`readResource` (ADR-0112): awaited before the
    // handler runs — but AFTER the 404, so a not-found never burns throttle.
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

  // --- Base tools (ADR-0008): visible to every authenticated caller. ---

  registerTool({
    name: "list_modules",
    description: "List the module ids in the registry catalog.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async () => ({
      modules: options.index.modules.map((m) => m.id).sort(),
    }),
  });

  registerTool({
    name: "describe_module",
    description: "Describe a single catalog module by id.",
    version: "1.0.0",
    audit: { logArgs: true },
    handler: async ({ args }) => {
      const { name } = parseStrict(describeArgs, args);
      const entry = options.index.modules.find((m) => m.id === name);
      if (entry === undefined) {
        throw new NotFoundError(`Unknown module: ${name}`);
      }
      const latest = entry.versions.find((v) => v.version === entry.latest);
      return {
        name,
        latest: entry.latest,
        summary: latest?.manifest.description ?? "",
      };
    },
  });

  registerTool({
    name: "generate",
    description: "Generate a project from a registry-catalog module selection.",
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
      // Registry catalog (ADR-0021/0004): every `{id, version}` must resolve in the BUILT index —
      // id AND version, the same gate the CLI generator runs. `assertKnownModule`/
      // `assertKnownVersion` throw a raw Error on a miss; surface it as a 400 ValidationError
      // (anti-injection), thrown BEFORE the host call.
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
      // The server owns no DB tx — it validated, now it delegates generation to the host.
      return options.onGenerate({
        accountId: session.accountId,
        selection: {
          projectName: input.projectName,
          modules: input.modules.map((m) => ({ id: m.id, version: m.version })),
        },
      });
    },
  });

  // --- Base resources: visible to every authenticated caller.

  // The full registry catalog as a resource — discovery is the point. The Bearer gate still fronts
  // it: any authenticated caller, never anonymous.
  registerResource({
    uri: "caisson://registry/index",
    name: "Caisson registry index",
    description:
      "The full Caisson module registry catalog (modules and versions) as JSON.",
    mimeType: "application/json",
    handler: async () => options.index,
  });

  // --- Base prompts: visible to every authenticated caller.

  // integrate_module: narrate the describe_module → generate recipe for one module. Validates
  // `moduleId` against the live registry index up front (mirroring `generate`'s catalog check), so
  // the prompt can never recommend a module the generator would reject.
  registerPrompt({
    name: "integrate_module",
    description:
      "Walk through adding one Caisson module to a project: describe it, then generate.",
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
        `1. Inspect the module first — call the describe_module tool with { "name": "${moduleId}" } to read its summary.`,
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
        "generate validates every requested module against the registry catalog, then writes the scaffold.",
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
  // ADR-0076 wire: the coach is just a kit registering its tools through the seam.
  if (options.coach) registerCoachTools(server, options.coach);
  // ADR-0330/0345 wire: the design-system tools (and their resource front) register
  // through the same seam, same one-way flow.
  if (options.dsManifest) registerManifestTools(server, options.dsManifest);
  // The compliance prompt registers through the same seam, same one-way flow.
  if (options.compliancePrompts)
    registerCompliancePrompts(server, options.index);
  // ADR-0360 S5 / ADR-0361/0362 wire: run_start/run_status register through the same seam, same
  // one-way flow — the injected host callbacks are the only coupling to the agent runtime.
  if (options.runTools) registerRunTools(server, options.runTools);
  return server;
}
