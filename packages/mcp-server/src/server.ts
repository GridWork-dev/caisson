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
} from "@caisson/registry";
import { registerCoachTools, type CoachOptions } from "./coach.ts";

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
 * One registered buyer-MCP tool (ADR-0076). `requiredEntitlement` is the edition slug a caller
 * must own to *see* and *invoke* this tool; `null` marks a base tool visible to every
 * authenticated buyer. The entitlement is re-validated timing-safe on every call (ADR-0008/0010).
 */
export interface ToolRegistration {
  readonly name: string;
  readonly requiredEntitlement: string | null;
  readonly handler: (ctx: ToolHandlerContext) => Promise<unknown>;
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
}

export interface McpServer {
  authenticate(bearer: string): McpSession;
  /**
   * Register an additional (edition) tool. Throws on a duplicate name (fail-closed) so an edition
   * can never silently shadow a base or peer tool.
   */
  registerTool(registration: ToolRegistration): void;
  /** The tools VISIBLE to this caller: base tools + only the edition tools they're entitled to. */
  listTools(session: McpSession): readonly string[];
  handleToolCall(
    session: McpSession,
    tool: string,
    args: unknown,
  ): Promise<unknown>;
}

const describeArgs = strictObject({ name: z.string().min(1) });
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
  // re-asserts the slug regex as defense-in-depth, so a loose string here is gated downstream.
  modules: z
    .array(strictObject({ id: z.string().min(1), version: z.string().min(1) }))
    .min(1),
  // Caller-supplied idempotency key (a true retry reuses it → debit-once). Minted when omitted.
  idempotencyKey: z.string().uuid().optional(),
});

export function createMcpServer(options: McpServerOptions): McpServer {
  const registry = new Map<string, ToolRegistration>();

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

  function listTools(session: McpSession): readonly string[] {
    return [...registry.values()]
      .filter((reg) => isEntitled(session, reg.requiredEntitlement))
      .map((reg) => reg.name)
      .sort();
  }

  async function handleToolCall(
    session: McpSession,
    tool: string,
    args: unknown,
  ): Promise<unknown> {
    const registration = registry.get(tool);
    // An unregistered tool — and a tool the caller is not entitled to — are both 404: the edition
    // tool is invisible, never leaking that it exists to a non-entitled caller.
    if (
      registration === undefined ||
      !isEntitled(session, registration.requiredEntitlement)
    ) {
      throw new NotFoundError(`Unknown tool: ${tool}`);
    }
    return registration.handler({ session, args });
  }

  // --- Base tools (ADR-0008): visible to every authenticated buyer, no edition entitlement. ---

  registerTool({
    name: "list_modules",
    requiredEntitlement: null,
    handler: async ({ session }) => ({
      modules: [...session.entitlements].sort(),
    }),
  });

  registerTool({
    name: "describe_module",
    requiredEntitlement: null,
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
    handler: async ({ session, args }) => {
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

  const server: McpServer = {
    authenticate,
    registerTool,
    listTools,
    handleToolCall,
  };
  // ADR-0076 wire: the coach is just an edition registering its tools through the seam.
  if (options.coach) registerCoachTools(server, options.coach);
  return server;
}
