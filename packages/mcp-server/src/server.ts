// The buyer-facing MCP server core (ADR-0008/0004/0076), transport-agnostic: the
// @modelcontextprotocol/sdk stdio/SSE transport binds to `handleToolCall`. Auth is a timing-safe
// Bearer (per-buyer/license token); reads are entitlement-scoped; the one base write surface
// (`generate`) validates every requested name against the registry allowlist BEFORE any
// file/subprocess use and re-checks entitlement, then delegates the credit debit (ADR-0007) to
// the host via `onGenerate`.
//
// ADR-0076 turns the fixed tool set into an extension seam: tools are *registered*, not enumerated
// in a hard switch. Each registration declares the entitlement it requires; `handleToolCall`
// re-validates the caller's entitlement per tool in constant time, and a tool the caller is not
// entitled to is invisible — excluded from `listTools` and indistinguishable (404) from a tool
// that does not exist. Editions register their own buyer tools through `registerTool`.
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

export interface GenerateContext {
  accountId: string;
  edition: string;
  modules: string[];
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
  /** Valid registry module/edition names — the ADR-0004 allowlist (anti-injection). */
  registryAllowlist: readonly string[];
  /** Host hook that performs the credit debit + drives generation (ADR-0007). */
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
  edition: z.string().min(1),
  modules: z.array(z.string().min(1)),
});

export function createMcpServer(options: McpServerOptions): McpServer {
  const allowlist = new Set(options.registryAllowlist);
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
      const requested = [input.edition, ...input.modules];
      // 1) allowlist: reject any name not in the registry BEFORE touching the filesystem.
      const unknown = requested.filter((r) => !allowlist.has(r));
      if (unknown.length > 0) {
        throw new ValidationError(
          `Unknown registry names: ${unknown.join(", ")}`,
          {
            unknown,
          },
        );
      }
      // 2) entitlement: the buyer must own every requested piece.
      const notEntitled = requested.filter((r) => !session.entitlements.has(r));
      if (notEntitled.length > 0) {
        throw new EntitlementError(
          `Not entitled to: ${notEntitled.join(", ")}`,
          {
            notEntitled,
          },
        );
      }
      // 3) credit debit + generation are the host's job (ADR-0007).
      return options.onGenerate({
        accountId: session.accountId,
        edition: input.edition,
        modules: input.modules,
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
