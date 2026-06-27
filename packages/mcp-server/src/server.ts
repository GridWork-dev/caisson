// The buyer-facing MCP server core (ADR-0008/0004), transport-agnostic: the
// @modelcontextprotocol/sdk stdio/SSE transport binds to `handleToolCall`. Auth is a timing-safe
// Bearer (per-buyer/license token); reads are entitlement-scoped; the one write surface
// (`generate`) validates every requested name against the registry allowlist BEFORE any
// file/subprocess use and re-checks entitlement, then delegates the credit debit (ADR-0007) to
// the host via `onGenerate`.
import { z } from "zod";
import {
  AuthnError,
  EntitlementError,
  NotFoundError,
  ValidationError,
  parseStrict,
  safeEqualFixed,
  strictObject,
} from "@stack/kernel";

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

export interface McpServerOptions {
  /** Issued buyer tokens (in prod: a DB lookup keyed by token hash). */
  tokens: readonly BuyerToken[];
  /** Valid registry module/edition names — the ADR-0004 allowlist (anti-injection). */
  registryAllowlist: readonly string[];
  /** Host hook that performs the credit debit + drives generation (ADR-0007). */
  onGenerate: (ctx: GenerateContext) => Promise<{ generationId: string }>;
}

export interface McpServer {
  authenticate(bearer: string): McpSession;
  handleToolCall(
    session: McpSession,
    tool: string,
    args: unknown,
  ): Promise<unknown>;
  readonly tools: readonly string[];
}

const describeArgs = strictObject({ name: z.string().min(1) });
const generateArgs = strictObject({
  edition: z.string().min(1),
  modules: z.array(z.string().min(1)),
});

export function createMcpServer(options: McpServerOptions): McpServer {
  const allowlist = new Set(options.registryAllowlist);

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

  async function handleToolCall(
    session: McpSession,
    tool: string,
    args: unknown,
  ): Promise<unknown> {
    switch (tool) {
      case "list_modules":
        return { modules: [...session.entitlements].sort() };

      case "describe_module": {
        const { name } = parseStrict(describeArgs, args);
        if (!session.entitlements.has(name)) {
          throw new EntitlementError(`Not entitled to module: ${name}`);
        }
        return {
          name,
          summary: `Module ${name} — conventions available to entitled buyers.`,
        };
      }

      case "generate": {
        const input = parseStrict(generateArgs, args);
        const requested = [input.edition, ...input.modules];
        // 1) allowlist: reject any name not in the registry BEFORE touching the filesystem.
        const unknown = requested.filter((r) => !allowlist.has(r));
        if (unknown.length > 0) {
          throw new ValidationError(
            `Unknown registry names: ${unknown.join(", ")}`,
            { unknown },
          );
        }
        // 2) entitlement: the buyer must own every requested piece.
        const notEntitled = requested.filter(
          (r) => !session.entitlements.has(r),
        );
        if (notEntitled.length > 0) {
          throw new EntitlementError(
            `Not entitled to: ${notEntitled.join(", ")}`,
            { notEntitled },
          );
        }
        // 3) credit debit + generation are the host's job (ADR-0007).
        return options.onGenerate({
          accountId: session.accountId,
          edition: input.edition,
          modules: input.modules,
        });
      }

      default:
        throw new NotFoundError(`Unknown tool: ${tool}`);
    }
  }

  return {
    authenticate,
    handleToolCall,
    tools: ["list_modules", "describe_module", "generate"],
  };
}
